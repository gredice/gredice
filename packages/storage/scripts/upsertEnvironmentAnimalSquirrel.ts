import { and, eq } from 'drizzle-orm';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
    attributeValues,
    closeStorage,
    createAttributeDefinition,
    createAttributeDefinitionCategory,
    entities,
    entityTypes,
    getAttributeDefinitions,
    storage,
    updateAttributeDefinition,
    updateAttributeDefinitionCategory,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '../src';
import {
    environmentAnimalAttributePath,
    environmentAnimalEntityTypeName,
    environmentAnimalSquirrelCategories,
    environmentAnimalSquirrelDefinitions,
    environmentAnimalSquirrelSpec,
    parseEnvironmentAnimalSquirrelOptions,
} from '../src/data/environmentAnimalSquirrel';
import { createNamedEntity } from './lib/createNamedEntity';

// Safe by default: use --apply only against the intended non-production
// environment, after the runtime asset is deployed. Repeated applies converge.

const actor = { id: 'codex', name: 'Codex' };

async function findEntity(nameDefinitionId: number) {
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
                eq(entities.entityTypeName, environmentAnimalEntityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.value, environmentAnimalSquirrelSpec.name),
            ),
        )
        .limit(2);
    if (matches.length > 1) {
        throw new Error('Multiple active Squirrel environment animals found.');
    }
    return matches[0] ?? null;
}

async function ensureEntityType(apply: boolean) {
    const matches = await storage().query.entityTypes.findMany({
        where: eq(entityTypes.name, environmentAnimalEntityTypeName),
    });
    const existing = matches.find((entry) => !entry.isDeleted) ?? matches[0];
    if (!apply) {
        return existing ?? null;
    }
    if (existing) {
        await upsertEntityType({
            id: existing.id,
            name: environmentAnimalEntityTypeName,
            label: 'Životinje okoliša',
            icon: 'PawPrint',
            order: 'game-environment-animals',
            isRoot: true,
            isDeleted: false,
        });
        return existing;
    }
    await storage().insert(entityTypes).values({
        name: environmentAnimalEntityTypeName,
        label: 'Životinje okoliša',
        icon: 'PawPrint',
        order: 'game-environment-animals',
        isRoot: true,
    });
    return storage().query.entityTypes.findFirst({
        where: and(
            eq(entityTypes.name, environmentAnimalEntityTypeName),
            eq(entityTypes.isDeleted, false),
        ),
    });
}

async function ensureCategories(apply: boolean) {
    for (const config of environmentAnimalSquirrelCategories) {
        const matches =
            await storage().query.attributeDefinitionCategories.findMany({
                where: and(
                    eq(
                        attributeDefinitionCategories.entityTypeName,
                        environmentAnimalEntityTypeName,
                    ),
                    eq(attributeDefinitionCategories.name, config.name),
                ),
            });
        const existing =
            matches.find((entry) => !entry.isDeleted) ?? matches[0];
        if (!apply) {
            continue;
        }
        if (existing) {
            if (existing.isDeleted) {
                await storage()
                    .update(attributeDefinitionCategories)
                    .set({ isDeleted: false })
                    .where(eq(attributeDefinitionCategories.id, existing.id));
            }
            await updateAttributeDefinitionCategory({
                id: existing.id,
                label: config.label,
                order: config.order,
            });
        } else {
            await createAttributeDefinitionCategory({
                ...config,
                entityTypeName: environmentAnimalEntityTypeName,
            });
        }
    }
}

async function ensureDefinitions(apply: boolean) {
    const matches = await storage().query.attributeDefinitions.findMany({
        where: eq(
            attributeDefinitions.entityTypeName,
            environmentAnimalEntityTypeName,
        ),
    });
    for (const config of environmentAnimalSquirrelDefinitions) {
        const existing = matches.find(
            (definition) =>
                definition.category === config.category &&
                definition.name === config.name,
        );
        if (!apply) {
            continue;
        }
        const value = {
            ...config,
            entityTypeName: environmentAnimalEntityTypeName,
            multiple: false,
        };
        if (existing) {
            if (existing.isDeleted) {
                await storage()
                    .update(attributeDefinitions)
                    .set({ isDeleted: false })
                    .where(eq(attributeDefinitions.id, existing.id));
            }
            await updateAttributeDefinition({ id: existing.id, ...value });
        } else {
            await createAttributeDefinition(value);
        }
    }
}

async function getExistingAttributeValue({
    attributeDefinitionId,
    entityId,
}: {
    attributeDefinitionId: number;
    entityId: number;
}) {
    return storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.attributeDefinitionId, attributeDefinitionId),
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function main() {
    const { apply } = parseEnvironmentAnimalSquirrelOptions(
        process.argv.slice(2),
    );
    const existingType = await ensureEntityType(apply);
    await ensureCategories(apply);
    await ensureDefinitions(apply);

    const definitions =
        existingType || apply
            ? await getAttributeDefinitions(environmentAnimalEntityTypeName)
            : [];
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            environmentAnimalAttributePath(definition),
            definition,
        ]),
    );
    const nameDefinition = definitionsByPath.get('information.name');
    let entity = nameDefinition ? await findEntity(nameDefinition.id) : null;
    let entityId = entity?.id ?? null;
    const missingDefinitions = environmentAnimalSquirrelDefinitions
        .map(environmentAnimalAttributePath)
        .filter((path) => !definitionsByPath.has(path));
    const changedAttributes: string[] = [];

    for (const [path, expectedValue] of Object.entries(
        environmentAnimalSquirrelSpec.attributes,
    )) {
        const definition = definitionsByPath.get(path);
        const current =
            definition && entityId
                ? await getExistingAttributeValue({
                      attributeDefinitionId: definition.id,
                      entityId,
                  })
                : null;
        if (current?.value !== expectedValue) {
            changedAttributes.push(path);
        }
    }

    const publish =
        entity?.state !== 'published' || entity.publishedAt === null;
    const summary = {
        mode: apply ? 'apply' : 'dry-run',
        entityType: {
            action: existingType ? 'update' : 'create',
            name: environmentAnimalEntityTypeName,
        },
        definitions: {
            configured: environmentAnimalSquirrelDefinitions.length,
            missing: missingDefinitions,
        },
        entity: {
            action: !entity
                ? 'create'
                : changedAttributes.length > 0 || publish
                  ? 'update'
                  : 'unchanged',
            changedAttributes,
            id: entityId,
            name: environmentAnimalSquirrelSpec.name,
            publish,
        },
    };

    if (!apply) {
        console.log(JSON.stringify(summary, null, 2));
        return;
    }
    if (missingDefinitions.length > 0) {
        throw new Error(
            `Failed to create definitions: ${missingDefinitions.join(', ')}`,
        );
    }
    if (!nameDefinition) {
        throw new Error('Missing information.name while applying Squirrel.');
    }
    if (!entityId) {
        entityId = await createNamedEntity({
            actor,
            entityTypeName: environmentAnimalEntityTypeName,
            name: environmentAnimalSquirrelSpec.name,
            nameDefinition,
        });
        summary.entity.id = entityId;
    }

    for (const [path, expectedValue] of Object.entries(
        environmentAnimalSquirrelSpec.attributes,
    )) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} while applying Squirrel.`);
        }
        const current = await getExistingAttributeValue({
            attributeDefinitionId: definition.id,
            entityId,
        });
        if (current?.value === expectedValue) {
            continue;
        }
        await upsertAttributeValue(
            {
                id: current?.id,
                attributeDefinitionId: definition.id,
                entityId,
                entityTypeName: environmentAnimalEntityTypeName,
                order: definition.order,
                value: expectedValue,
            },
            actor,
        );
    }
    if (publish) {
        await updateEntity({ id: entityId, state: 'published' }, actor);
    }

    entity = await findEntity(nameDefinition?.id ?? 0);
    if (
        !entity ||
        entity.id !== entityId ||
        entity.state !== 'published' ||
        entity.publishedAt === null
    ) {
        throw new Error('Failed to publish the Squirrel environment animal.');
    }
    for (const [path, expectedValue] of Object.entries(
        environmentAnimalSquirrelSpec.attributes,
    )) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} during readback.`);
        }
        const stored = await getExistingAttributeValue({
            attributeDefinitionId: definition.id,
            entityId,
        });
        if (stored?.value !== expectedValue) {
            throw new Error(
                `Unexpected ${path}: ${stored?.value ?? 'missing'}`,
            );
        }
    }

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
