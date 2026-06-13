import {
    closeStorage,
    createAttributeDefinition,
    getAttributeDefinitions,
    getEntitiesFormatted,
    getEntityRaw,
    type SelectAttributeDefinition,
    upsertAttributeValue,
} from '@gredice/storage';
import {
    bedMaintenanceOperationCoverRecipes,
    cuttingOperationCoverRecipes,
    harvestOperationCoverRecipes,
    inventoryOperationCoverRecipes,
    photographyOperationCoverRecipes,
    plantingOperationCoverRecipes,
    protectionOperationCoverRecipes,
    sensorOperationCoverRecipes,
    soilOperationCoverRecipes,
    storageOperationCoverRecipes,
    supportOperationCoverRecipes,
    validateOperationCoverRecipes,
    waterOperationCoverRecipes,
} from './operation-cover-recipes';

type OperationDirectoryEntity = {
    id: number;
    information?: {
        name?: string;
    };
    image?: {
        cover?: {
            url?: string;
        };
    };
};

type ExistingCoverValue = {
    id?: number;
    value?: string | null;
};

const actor = {
    id: 'codex',
    name: 'Codex',
};
const entityTypeName = 'operation';
const defaultBaseUrl = 'https://www.gredice.com/assets/operation-icons';
const coverDefinitionConfig = {
    category: 'image',
    dataType: 'image',
    description:
        'Public operation cover image used by directory cards, detail pages, search results, and compact operation UI.',
    display: true,
    entityTypeName,
    label: 'Cover image',
    multiple: false,
    name: 'cover',
    order: 'za',
    required: false,
};

const targetOperationCoverRecipes = [
    ...waterOperationCoverRecipes,
    ...harvestOperationCoverRecipes,
    ...inventoryOperationCoverRecipes,
    ...photographyOperationCoverRecipes,
    ...plantingOperationCoverRecipes,
    ...protectionOperationCoverRecipes,
    ...sensorOperationCoverRecipes,
    ...soilOperationCoverRecipes,
    ...storageOperationCoverRecipes,
    ...supportOperationCoverRecipes,
    ...cuttingOperationCoverRecipes,
    ...bedMaintenanceOperationCoverRecipes,
] as const;

function parseArgs(argv: string[]) {
    const options = {
        apply: false,
        baseUrl: defaultBaseUrl,
        replaceExisting: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--apply') {
            options.apply = true;
            continue;
        }
        if (arg === '--replace-existing') {
            options.replaceExisting = true;
            continue;
        }
        if (arg === '--base-url') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('--base-url requires a value.');
            }
            options.baseUrl = value;
            index += 1;
            continue;
        }
        if (arg.startsWith('--base-url=')) {
            options.baseUrl = arg.slice('--base-url='.length);
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    options.baseUrl = options.baseUrl.replace(/\/+$/u, '');
    return options;
}

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

async function getOperationDefinitionsByPath() {
    const definitions = await getAttributeDefinitions(entityTypeName);
    return new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
}

function assertCompatibleCoverDefinition(
    definition: SelectAttributeDefinition,
) {
    if (
        definition.dataType !== 'image' &&
        !definition.dataType.startsWith('json')
    ) {
        throw new Error(
            `Existing image.cover definition uses unsupported data type ${definition.dataType}.`,
        );
    }
}

async function ensureCoverDefinition({ apply }: { apply: boolean }) {
    const definitionsByPath = await getOperationDefinitionsByPath();
    const existingDefinition = definitionsByPath.get('image.cover');
    if (existingDefinition) {
        assertCompatibleCoverDefinition(existingDefinition);
        return {
            created: false,
            definition: existingDefinition,
            wouldCreate: false,
        };
    }

    if (!apply) {
        return {
            created: false,
            definition: null,
            wouldCreate: true,
        };
    }

    const id = await createAttributeDefinition(coverDefinitionConfig);
    const refreshedDefinitionsByPath = await getOperationDefinitionsByPath();
    const createdDefinition = refreshedDefinitionsByPath.get('image.cover');
    if (!createdDefinition || createdDefinition.id !== id) {
        throw new Error('Failed to create operation image.cover definition.');
    }
    assertCompatibleCoverDefinition(createdDefinition);
    return {
        created: true,
        definition: createdDefinition,
        wouldCreate: false,
    };
}

function operationName(operation: OperationDirectoryEntity) {
    return operation.information?.name?.trim() ?? '';
}

function coverUrl(baseUrl: string, outputFileName: string) {
    return `${baseUrl}/${encodeURIComponent(outputFileName)}`;
}

async function getExistingCoverValue({
    attributeDefinitionId,
    entityId,
}: {
    attributeDefinitionId: number | null;
    entityId: number;
}): Promise<ExistingCoverValue | null> {
    if (!attributeDefinitionId) {
        return null;
    }

    const raw = await getEntityRaw(entityId);
    const existing = raw?.attributes.find(
        (attribute) =>
            attribute.attributeDefinitionId === attributeDefinitionId &&
            !attribute.isDeleted,
    );

    return existing ? { id: existing.id, value: existing.value } : null;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const recipeValidationErrors = validateOperationCoverRecipes(
        targetOperationCoverRecipes,
    );
    if (recipeValidationErrors.length > 0) {
        throw new Error(
            `Invalid operation cover recipes:\n${recipeValidationErrors.join('\n')}`,
        );
    }

    const coverDefinitionResult = await ensureCoverDefinition({
        apply: options.apply,
    });
    const operations =
        await getEntitiesFormatted<OperationDirectoryEntity>(entityTypeName);
    const operationsByName = new Map<string, OperationDirectoryEntity>();

    for (const operation of operations) {
        const name = operationName(operation);
        if (!name) {
            continue;
        }
        if (operationsByName.has(name)) {
            throw new Error(`Duplicate published operation name: ${name}.`);
        }
        operationsByName.set(name, operation);
    }

    const recipesByOperationId = new Map(
        targetOperationCoverRecipes.map((recipe) => [
            recipe.operationId,
            recipe,
        ]),
    );
    if (recipesByOperationId.size !== targetOperationCoverRecipes.length) {
        throw new Error(
            'Operation cover recipes contain duplicate operation IDs.',
        );
    }

    const planned: Array<{
        operationId: string;
        entityId: number;
        url: string;
        action: 'create' | 'update' | 'skip-existing' | 'unchanged';
    }> = [];
    const missingOperations: string[] = [];

    for (const recipe of targetOperationCoverRecipes) {
        const operation = operationsByName.get(recipe.operationId);
        if (!operation) {
            missingOperations.push(recipe.operationId);
            continue;
        }

        const nextUrl = coverUrl(options.baseUrl, recipe.outputFileName);
        const currentUrl = operation.image?.cover?.url;
        if (currentUrl === nextUrl) {
            planned.push({
                operationId: recipe.operationId,
                entityId: operation.id,
                url: nextUrl,
                action: 'unchanged',
            });
            continue;
        }

        if (currentUrl && !options.replaceExisting) {
            planned.push({
                operationId: recipe.operationId,
                entityId: operation.id,
                url: currentUrl,
                action: 'skip-existing',
            });
            continue;
        }

        planned.push({
            operationId: recipe.operationId,
            entityId: operation.id,
            url: nextUrl,
            action: currentUrl ? 'update' : 'create',
        });
    }

    if (missingOperations.length > 0) {
        throw new Error(
            `Missing published operations for recipes: ${missingOperations.join(', ')}`,
        );
    }

    const mutations = planned.filter(
        (item) => item.action === 'create' || item.action === 'update',
    );
    if (options.apply) {
        if (!coverDefinitionResult.definition) {
            throw new Error('Cannot apply without image.cover definition.');
        }

        for (const mutation of mutations) {
            const existingValue = await getExistingCoverValue({
                attributeDefinitionId: coverDefinitionResult.definition.id,
                entityId: mutation.entityId,
            });
            await upsertAttributeValue(
                {
                    id: existingValue?.id,
                    attributeDefinitionId: coverDefinitionResult.definition.id,
                    entityId: mutation.entityId,
                    entityTypeName,
                    order: coverDefinitionResult.definition.order,
                    value: JSON.stringify({
                        url: mutation.url,
                        alt:
                            recipesByOperationId.get(mutation.operationId)
                                ?.operationLabel ?? mutation.operationId,
                    }),
                },
                actor,
            );
        }
    }

    const summary = {
        mode: options.apply ? 'apply' : 'dry-run',
        baseUrl: options.baseUrl,
        replaceExisting: options.replaceExisting,
        recipes: targetOperationCoverRecipes.length,
        coverDefinition: {
            created: coverDefinitionResult.created,
            exists: Boolean(coverDefinitionResult.definition),
            wouldCreate: coverDefinitionResult.wouldCreate,
        },
        create: planned.filter((item) => item.action === 'create').length,
        update: planned.filter((item) => item.action === 'update').length,
        skipExisting: planned.filter((item) => item.action === 'skip-existing')
            .length,
        unchanged: planned.filter((item) => item.action === 'unchanged').length,
        operations: planned,
    };

    console.log(JSON.stringify(summary, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
