import {
    attributeDefinitionPath,
    attributeValues,
    closeStorage,
    createAttributeDefinition,
    generatedImageAttributeValue,
    generatedImageUrlDefaultValue,
    getAttributeDefinitions,
    getEntitiesRaw,
    imageUrlFromAttributeValue,
    type SelectAttributeDefinition,
    storage,
    updateAttributeDefinition,
    upsertAttributeValue,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';

type DirectoryEntity = Awaited<ReturnType<typeof getEntitiesRaw>>[number];

type AttributePath = {
    category: string;
    name: string;
};

type ExistingTargetValue = {
    id?: number;
    value?: string | null;
};

type Options = {
    apply: boolean;
    description: string | null;
    display: boolean;
    entityTypeName: string;
    excludeValues: Set<string>;
    label: string;
    order: string | null;
    source: string;
    target: string;
    template: string;
};

const actor = {
    id: 'codex',
    name: 'Codex',
};

function readOptionValue(argv: string[], index: number, option: string) {
    const value = argv[index + 1];
    if (!value) {
        throw new Error(`${option} requires a value.`);
    }
    return value;
}

function parseArgs(argv: string[]): Options {
    const options: Options = {
        apply: false,
        description: null,
        display: true,
        entityTypeName: '',
        excludeValues: new Set(),
        label: 'Image',
        order: null,
        source: '',
        target: '',
        template: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--') {
            continue;
        }
        if (arg === '--apply') {
            options.apply = true;
            continue;
        }
        if (arg === '--no-display') {
            options.display = false;
            continue;
        }
        if (arg === '--entity-type') {
            options.entityTypeName = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (arg.startsWith('--entity-type=')) {
            options.entityTypeName = arg.slice('--entity-type='.length);
            continue;
        }
        if (arg === '--source') {
            options.source = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (arg.startsWith('--source=')) {
            options.source = arg.slice('--source='.length);
            continue;
        }
        if (arg === '--target') {
            options.target = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (arg.startsWith('--target=')) {
            options.target = arg.slice('--target='.length);
            continue;
        }
        if (arg === '--template') {
            options.template = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (arg.startsWith('--template=')) {
            options.template = arg.slice('--template='.length);
            continue;
        }
        if (arg === '--label') {
            options.label = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (arg.startsWith('--label=')) {
            options.label = arg.slice('--label='.length);
            continue;
        }
        if (arg === '--description') {
            options.description = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (arg.startsWith('--description=')) {
            options.description = arg.slice('--description='.length);
            continue;
        }
        if (arg === '--order') {
            options.order = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (arg.startsWith('--order=')) {
            options.order = arg.slice('--order='.length);
            continue;
        }
        if (arg === '--exclude-value' || arg === '--exclude-name') {
            options.excludeValues.add(readOptionValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg.startsWith('--exclude-value=')) {
            options.excludeValues.add(arg.slice('--exclude-value='.length));
            continue;
        }
        if (arg.startsWith('--exclude-name=')) {
            options.excludeValues.add(arg.slice('--exclude-name='.length));
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!options.entityTypeName) {
        throw new Error('--entity-type is required.');
    }
    if (!options.source) {
        throw new Error('--source is required.');
    }
    if (!options.target) {
        throw new Error('--target is required.');
    }
    if (!options.template) {
        throw new Error('--template is required.');
    }

    return options;
}

function parseAttributePath(path: string): AttributePath {
    const [category, ...nameParts] = path.split('.');
    const name = nameParts.join('.');
    if (!category || !name) {
        throw new Error(`Invalid attribute path: ${path}`);
    }
    return { category, name };
}

async function getDefinitionsByPath(entityTypeName: string) {
    const definitions = await getAttributeDefinitions(entityTypeName);
    return new Map(
        definitions.map((definition) => [
            attributeDefinitionPath(definition),
            definition,
        ]),
    );
}

function targetDefinitionConfig(options: Options) {
    const target = parseAttributePath(options.target);
    return {
        category: target.category,
        dataType: 'image',
        defaultValue: generatedImageUrlDefaultValue({
            source: options.source,
            template: options.template,
        }),
        description: options.description,
        display: options.display,
        entityTypeName: options.entityTypeName,
        label: options.label,
        multiple: false,
        name: target.name,
        order: options.order,
        required: false,
    };
}

function definitionNeedsUpdate(
    definition: SelectAttributeDefinition,
    options: Options,
) {
    const config = targetDefinitionConfig(options);
    return (
        definition.dataType !== config.dataType ||
        definition.defaultValue !== config.defaultValue ||
        definition.description !== config.description ||
        definition.display !== config.display ||
        definition.label !== config.label ||
        definition.multiple !== config.multiple ||
        definition.order !== config.order ||
        definition.required !== config.required
    );
}

async function ensureTargetDefinition(options: Options) {
    const definitionsByPath = await getDefinitionsByPath(
        options.entityTypeName,
    );
    const existingDefinition = definitionsByPath.get(options.target);
    const config = targetDefinitionConfig(options);
    if (existingDefinition) {
        if (!options.apply) {
            return {
                created: false,
                definition: existingDefinition,
                updated: false,
                wouldCreate: false,
                wouldUpdate: definitionNeedsUpdate(existingDefinition, options),
            };
        }

        if (definitionNeedsUpdate(existingDefinition, options)) {
            await updateAttributeDefinition({
                id: existingDefinition.id,
                ...config,
            });
        }
        const refreshedDefinitionsByPath = await getDefinitionsByPath(
            options.entityTypeName,
        );
        const updatedDefinition = refreshedDefinitionsByPath.get(
            options.target,
        );
        if (!updatedDefinition) {
            throw new Error(
                `Failed to update ${options.entityTypeName}.${options.target} definition.`,
            );
        }
        return {
            created: false,
            definition: updatedDefinition,
            updated: definitionNeedsUpdate(existingDefinition, options),
            wouldCreate: false,
            wouldUpdate: false,
        };
    }

    if (!options.apply) {
        return {
            created: false,
            definition: null,
            updated: false,
            wouldCreate: true,
            wouldUpdate: false,
        };
    }

    const id = await createAttributeDefinition(config);
    const refreshedDefinitionsByPath = await getDefinitionsByPath(
        options.entityTypeName,
    );
    const createdDefinition = refreshedDefinitionsByPath.get(options.target);
    if (!createdDefinition || createdDefinition.id !== id) {
        throw new Error(
            `Failed to create ${options.entityTypeName}.${options.target} definition.`,
        );
    }
    return {
        created: true,
        definition: createdDefinition,
        updated: false,
        wouldCreate: false,
        wouldUpdate: false,
    };
}

function attributeValue(entity: DirectoryEntity, path: string) {
    return (
        entity.attributes.find(
            (attribute) =>
                attributeDefinitionPath(attribute.attributeDefinition) === path,
        )?.value ?? null
    );
}

async function getExistingTargetValue({
    attributeDefinitionId,
    entityId,
}: {
    attributeDefinitionId: number | null;
    entityId: number;
}): Promise<ExistingTargetValue | null> {
    if (!attributeDefinitionId) {
        return null;
    }

    const existing = await storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.attributeDefinitionId, attributeDefinitionId),
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.isDeleted, false),
        ),
    });

    return existing ? { id: existing.id, value: existing.value } : null;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const sourcePath = parseAttributePath(options.source);
    const targetPath = parseAttributePath(options.target);
    const definitionsByPath = await getDefinitionsByPath(
        options.entityTypeName,
    );
    const sourceDefinition = definitionsByPath.get(options.source);
    if (!sourceDefinition) {
        throw new Error(
            `Missing source definition ${options.entityTypeName}.${sourcePath.category}.${sourcePath.name}.`,
        );
    }

    const targetDefinitionResult = await ensureTargetDefinition(options);
    const entities = await getEntitiesRaw(options.entityTypeName);
    const generatedConfig = {
        kind: 'generated-image-url',
        source: options.source,
        template: options.template,
    } as const;
    const planned: Array<{
        entityId: number;
        sourceValue: string | null;
        url: string | null;
        action:
            | 'create'
            | 'update'
            | 'unchanged'
            | 'missing-source'
            | 'excluded';
    }> = [];

    for (const entity of entities) {
        const sourceValue =
            attributeValue(entity, options.source)?.trim() ?? '';
        if (!sourceValue) {
            planned.push({
                entityId: entity.id,
                sourceValue: null,
                url: null,
                action: 'missing-source',
            });
            continue;
        }

        if (options.excludeValues.has(sourceValue)) {
            planned.push({
                entityId: entity.id,
                sourceValue,
                url: null,
                action: 'excluded',
            });
            continue;
        }

        const nextValue = generatedImageAttributeValue(
            generatedConfig,
            sourceValue,
        );
        const url = imageUrlFromAttributeValue(nextValue);
        if (!nextValue || !url) {
            planned.push({
                entityId: entity.id,
                sourceValue,
                url: null,
                action: 'missing-source',
            });
            continue;
        }

        const existingValue = await getExistingTargetValue({
            attributeDefinitionId:
                targetDefinitionResult.definition?.id ?? null,
            entityId: entity.id,
        });
        const currentUrl = imageUrlFromAttributeValue(existingValue?.value);
        planned.push({
            entityId: entity.id,
            sourceValue,
            url,
            action: currentUrl
                ? currentUrl === url
                    ? 'unchanged'
                    : 'update'
                : 'create',
        });
    }

    const mutations = planned.filter(
        (item) => item.action === 'create' || item.action === 'update',
    );
    if (options.apply) {
        if (!targetDefinitionResult.definition) {
            throw new Error(
                `Cannot apply without ${options.target} definition.`,
            );
        }

        for (const mutation of mutations) {
            if (!mutation.url) {
                continue;
            }
            const existingValue = await getExistingTargetValue({
                attributeDefinitionId: targetDefinitionResult.definition.id,
                entityId: mutation.entityId,
            });
            await upsertAttributeValue(
                {
                    id: existingValue?.id,
                    attributeDefinitionId: targetDefinitionResult.definition.id,
                    entityId: mutation.entityId,
                    entityTypeName: options.entityTypeName,
                    order: targetDefinitionResult.definition.order,
                    value: generatedImageAttributeValue(
                        generatedConfig,
                        mutation.sourceValue,
                    ),
                },
                actor,
            );
        }
    }

    const summary = {
        mode: options.apply ? 'apply' : 'dry-run',
        entityTypeName: options.entityTypeName,
        excludedValues: Array.from(options.excludeValues),
        source: options.source,
        target: options.target,
        targetDefinition: {
            created: targetDefinitionResult.created,
            exists: Boolean(targetDefinitionResult.definition),
            updated: targetDefinitionResult.updated,
            wouldCreate: targetDefinitionResult.wouldCreate,
            wouldUpdate: targetDefinitionResult.wouldUpdate,
        },
        template: options.template,
        total: entities.length,
        create: planned.filter((item) => item.action === 'create').length,
        update: planned.filter((item) => item.action === 'update').length,
        unchanged: planned.filter((item) => item.action === 'unchanged').length,
        missingSource: planned.filter(
            (item) => item.action === 'missing-source',
        ).length,
        excluded: planned.filter((item) => item.action === 'excluded').length,
        examples: planned
            .filter(
                (item) => item.action === 'create' || item.action === 'update',
            )
            .slice(0, 10),
        targetPath,
    };

    console.log(JSON.stringify(summary, null, 2));
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
