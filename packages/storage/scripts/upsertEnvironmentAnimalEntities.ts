import { and, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    createAttributeDefinition,
    createAttributeDefinitionCategory,
    createEntity,
    entities,
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
    getEntityTypeByName,
    type SelectAttributeDefinition,
    storage,
    updateAttributeDefinition,
    updateAttributeDefinitionCategory,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '../src';
import {
    batEnvironmentAnimal,
    environmentAnimalCategories,
    environmentAnimalDefinitionPath,
    environmentAnimalDefinitions,
    environmentAnimalEntityType,
} from './lib/environmentAnimalDirectory';

// This helper deliberately rejects non-development writes. Production remains
// an explicit release operation after the runtime asset and code are deployed.

const actor = { id: 'codex', name: 'Codex' };

function parseOptions(argv: string[]) {
    let apply = false;
    let target: string | null = null;
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--') {
            continue;
        }
        if (argument === '--apply') {
            apply = true;
            continue;
        }
        if (argument === '--target') {
            const value = argv[index + 1];
            if (!value || value.startsWith('--')) {
                throw new Error('--target requires an environment name.');
            }
            target = value;
            index += 1;
            continue;
        }
        if (argument.startsWith('--target=')) {
            target = argument.slice('--target='.length);
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }
    if (!target) {
        throw new Error('--target development is required.');
    }
    if (apply && target !== 'development') {
        throw new Error('Writes are restricted to --target development.');
    }
    if (
        apply &&
        process.env.VERCEL_ENV &&
        process.env.VERCEL_ENV !== 'development'
    ) {
        throw new Error(
            `Configured VERCEL_ENV is ${process.env.VERCEL_ENV}; refusing a development write.`,
        );
    }
    return { apply, target };
}

function changedFields(
    current: Record<string, unknown>,
    expected: Record<string, unknown>,
) {
    return Object.entries(expected)
        .filter(([key, value]) => current[key] !== value)
        .map(([key]) => key);
}

async function reconcileEntityType(apply: boolean) {
    const existing = await getEntityTypeByName(
        environmentAnimalEntityType.name,
    );
    const changes = existing
        ? changedFields(existing, environmentAnimalEntityType)
        : Object.keys(environmentAnimalEntityType);
    if (apply && !existing) {
        await upsertEntityType(environmentAnimalEntityType);
    } else if (apply && existing && changes.length > 0) {
        await upsertEntityType({
            id: existing.id,
            ...environmentAnimalEntityType,
        });
    }
    return {
        action: !existing
            ? 'create'
            : changes.length > 0
              ? 'update'
              : 'unchanged',
        changedFields: changes,
        id: existing?.id ?? null,
    };
}

async function reconcileCategories(apply: boolean) {
    const existing = await getAttributeDefinitionCategories(
        environmentAnimalEntityType.name,
    );
    const summaries = [];
    for (const category of environmentAnimalCategories) {
        const current = existing.find((item) => item.name === category.name);
        const expected = {
            ...category,
            entityTypeName: environmentAnimalEntityType.name,
        };
        const changes = current
            ? changedFields(current, expected)
            : Object.keys(expected);
        if (apply && !current) {
            await createAttributeDefinitionCategory(expected);
        } else if (apply && current && changes.length > 0) {
            await updateAttributeDefinitionCategory({
                id: current.id,
                ...expected,
            });
        }
        summaries.push({
            action: !current
                ? 'create'
                : changes.length > 0
                  ? 'update'
                  : 'unchanged',
            changedFields: changes,
            name: category.name,
        });
    }
    return summaries;
}

async function reconcileDefinitions(apply: boolean) {
    const existing = await getAttributeDefinitions(
        environmentAnimalEntityType.name,
    );
    const summaries = [];
    for (const definition of environmentAnimalDefinitions) {
        const current = existing.find(
            (item) =>
                item.category === definition.category &&
                item.name === definition.name,
        );
        const changes = current
            ? changedFields(current, definition)
            : Object.keys(definition);
        if (apply && !current) {
            await createAttributeDefinition(definition);
        } else if (apply && current && changes.length > 0) {
            await updateAttributeDefinition({ id: current.id, ...definition });
        }
        summaries.push({
            action: !current
                ? 'create'
                : changes.length > 0
                  ? 'update'
                  : 'unchanged',
            changedFields: changes,
            path: environmentAnimalDefinitionPath(definition),
        });
    }
    return summaries;
}

async function findEnvironmentAnimalEntity(
    nameDefinition: SelectAttributeDefinition | undefined,
) {
    if (!nameDefinition) {
        return null;
    }
    const matches = await storage()
        .select({
            id: entities.id,
            publishedAt: entities.publishedAt,
            state: entities.state,
        })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, environmentAnimalEntityType.name),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinition.id),
                eq(attributeValues.value, batEnvironmentAnimal.name),
            ),
        )
        .limit(2);
    if (matches.length > 1) {
        throw new Error(
            'Multiple active Bat environment-animal entities found.',
        );
    }
    return matches[0] ?? null;
}

async function getExistingValue(entityId: number, definitionId: number) {
    return storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, definitionId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function reconcileBatEntity(apply: boolean) {
    let definitions = await getAttributeDefinitions(
        environmentAnimalEntityType.name,
    );
    let definitionsByPath = new Map(
        definitions.map((definition) => [
            environmentAnimalDefinitionPath(definition),
            definition,
        ]),
    );
    let entity = await findEnvironmentAnimalEntity(
        definitionsByPath.get('information.name'),
    );
    let entityId = entity?.id ?? null;
    const changedAttributes: string[] = [];

    for (const [path, expectedValue] of Object.entries(
        batEnvironmentAnimal.attributes,
    )) {
        const definition = definitionsByPath.get(path);
        if (!definition || !entityId) {
            changedAttributes.push(path);
            continue;
        }
        const current = await getExistingValue(entityId, definition.id);
        if (current?.value !== expectedValue) {
            changedAttributes.push(path);
        }
    }
    const publish =
        entity?.state !== 'published' || entity.publishedAt === null;
    const action = !entity
        ? 'create'
        : changedAttributes.length > 0 || publish
          ? 'update'
          : 'unchanged';

    if (!apply) {
        return { action, changedAttributes, entityId, publish };
    }

    definitions = await getAttributeDefinitions(
        environmentAnimalEntityType.name,
    );
    definitionsByPath = new Map(
        definitions.map((definition) => [
            environmentAnimalDefinitionPath(definition),
            definition,
        ]),
    );
    if (!entityId) {
        entityId = await createEntity(environmentAnimalEntityType.name, actor);
    }
    const orderedAttributes = Object.entries(
        batEnvironmentAnimal.attributes,
    ).sort(([left], [right]) =>
        left === 'information.name'
            ? -1
            : right === 'information.name'
              ? 1
              : left.localeCompare(right),
    );
    for (const [path, expectedValue] of orderedAttributes) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} after definition reconciliation.`);
        }
        const current = await getExistingValue(entityId, definition.id);
        if (current?.value === expectedValue) {
            continue;
        }
        await upsertAttributeValue(
            {
                id: current?.id,
                attributeDefinitionId: definition.id,
                entityId,
                entityTypeName: environmentAnimalEntityType.name,
                order: definition.order,
                value: expectedValue,
            },
            actor,
        );
    }
    if (publish) {
        await updateEntity({ id: entityId, state: 'published' }, actor);
    }

    entity = await findEnvironmentAnimalEntity(
        definitionsByPath.get('information.name'),
    );
    if (
        !entity ||
        entity.id !== entityId ||
        entity.state !== 'published' ||
        entity.publishedAt === null
    ) {
        throw new Error('Bat environment-animal publication readback failed.');
    }
    for (const [path, expectedValue] of orderedAttributes) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} during final readback.`);
        }
        const stored = await getExistingValue(entityId, definition.id);
        if (stored?.value !== expectedValue) {
            throw new Error(
                `Unexpected Bat ${path}: ${stored?.value ?? 'missing'}.`,
            );
        }
    }
    return { action, changedAttributes, entityId, publish };
}

async function main() {
    const { apply, target } = parseOptions(process.argv.slice(2));
    const entityType = await reconcileEntityType(apply);
    const categories = await reconcileCategories(apply);
    const definitions = await reconcileDefinitions(apply);
    const bat = await reconcileBatEntity(apply);
    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                target,
                entityType,
                categories,
                definitions,
                animals: [bat],
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
