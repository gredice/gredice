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
    getEntityTypeCategories,
    storage,
    updateAttributeDefinition,
    updateAttributeDefinitionCategory,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    upsertEntityTypeCategory,
} from '../src';
import {
    environmentAnimalAttributeCategories,
    environmentAnimalAttributeDefinitions,
    environmentAnimalAttributePath,
    environmentAnimalType,
    environmentAnimalTypeCategory,
    slugEnvironmentAnimal,
} from '../src/environmentAnimalSlug';

const apply = process.argv.includes('--apply');
const actor = {
    id: 'codex-environment-animal-slug',
    name: 'Slug environment-animal catalog upsert',
};

async function ensureTypeCategory() {
    const existing = (await getEntityTypeCategories()).find(
        (category) => category.name === environmentAnimalTypeCategory.name,
    );
    if (!apply) {
        return existing?.id ?? null;
    }
    await upsertEntityTypeCategory(
        existing
            ? { ...environmentAnimalTypeCategory, id: existing.id }
            : environmentAnimalTypeCategory,
    );
    return (await getEntityTypeCategories()).find(
        (category) => category.name === environmentAnimalTypeCategory.name,
    )?.id;
}

async function ensureEntityType(categoryId: number | null | undefined) {
    const existing = await getEntityTypeByName(environmentAnimalType.name);
    if (!apply) {
        return existing;
    }
    await upsertEntityType(
        existing
            ? {
                  ...environmentAnimalType,
                  categoryId,
                  id: existing.id,
                  isRoot: true,
              }
            : {
                  ...environmentAnimalType,
                  categoryId,
                  isRoot: true,
              },
    );
    return getEntityTypeByName(environmentAnimalType.name);
}

async function ensureAttributeCategories() {
    const existing = await getAttributeDefinitionCategories(
        environmentAnimalType.name,
    );
    for (const category of environmentAnimalAttributeCategories) {
        const current = existing.find(
            (candidate) =>
                candidate.name === category.name && !candidate.isDeleted,
        );
        if (!apply) {
            continue;
        }
        if (current) {
            await updateAttributeDefinitionCategory({
                ...category,
                id: current.id,
            });
        } else {
            await createAttributeDefinitionCategory({
                ...category,
                entityTypeName: environmentAnimalType.name,
            });
        }
    }
}

async function ensureAttributeDefinitions() {
    await ensureAttributeCategories();
    const existing = await getAttributeDefinitions(environmentAnimalType.name);
    for (const definition of environmentAnimalAttributeDefinitions) {
        const current = existing.find(
            (candidate) =>
                candidate.category === definition.category &&
                candidate.name === definition.name,
        );
        if (!apply) {
            continue;
        }
        const value = {
            ...definition,
            entityTypeName: environmentAnimalType.name,
            multiple: false,
        };
        if (current) {
            await updateAttributeDefinition({ ...value, id: current.id });
        } else {
            await createAttributeDefinition(value);
        }
    }
    return apply
        ? getAttributeDefinitions(environmentAnimalType.name)
        : existing;
}

async function findSlugEntityId(nameDefinitionId: number) {
    const [entity] = await storage()
        .select({ id: entities.id })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, environmentAnimalType.name),
                eq(entities.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.isDeleted, false),
                eq(
                    attributeValues.value,
                    slugEnvironmentAnimal.values['information.name'],
                ),
            ),
        )
        .limit(1);
    return entity?.id ?? null;
}

async function existingValue(entityId: number, attributeDefinitionId: number) {
    return storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, attributeDefinitionId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function readback(
    entityId: number,
    definitions: Awaited<ReturnType<typeof getAttributeDefinitions>>,
) {
    const values = await storage().query.attributeValues.findMany({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.isDeleted, false),
        ),
    });
    const definitionsById = new Map(
        definitions.map((definition) => [definition.id, definition]),
    );
    const actual = Object.fromEntries(
        values.flatMap((value) => {
            const definition = definitionsById.get(value.attributeDefinitionId);
            return definition
                ? [[environmentAnimalAttributePath(definition), value.value]]
                : [];
        }),
    );
    const mismatches = Object.entries(slugEnvironmentAnimal.values).filter(
        ([path, value]) => actual[path] !== value,
    );
    const entity = await storage().query.entities.findFirst({
        where: and(eq(entities.id, entityId), eq(entities.isDeleted, false)),
    });
    if (
        mismatches.length > 0 ||
        entity?.state !== slugEnvironmentAnimal.state
    ) {
        throw new Error(
            `Slug environment-animal readback failed: ${JSON.stringify({ entityState: entity?.state, mismatches })}`,
        );
    }
    return { entityId, state: entity.state, values: actual };
}

async function main() {
    const typeBefore = await getEntityTypeByName(environmentAnimalType.name);
    const existingDefinitions = typeBefore
        ? await getAttributeDefinitions(environmentAnimalType.name)
        : [];
    const nameDefinition = existingDefinitions.find(
        (definition) =>
            environmentAnimalAttributePath(definition) === 'information.name',
    );
    const existingEntityId = nameDefinition
        ? await findSlugEntityId(nameDefinition.id)
        : null;
    const existingPaths = new Set(
        existingDefinitions.map(environmentAnimalAttributePath),
    );

    if (!apply) {
        console.log(
            JSON.stringify(
                {
                    action: 'dry-run',
                    applyCommand:
                        'pnpm --filter @gredice/storage environment-animals:slug:upsert -- --apply',
                    catalog: slugEnvironmentAnimal,
                    changes: {
                        createEntity: existingEntityId === null,
                        createEntityType: typeBefore === undefined,
                        missingAttributeDefinitions:
                            environmentAnimalAttributeDefinitions
                                .map(environmentAnimalAttributePath)
                                .filter((path) => !existingPaths.has(path)),
                    },
                },
                null,
                2,
            ),
        );
        return;
    }

    const categoryId = await ensureTypeCategory();
    const entityType = await ensureEntityType(categoryId);
    if (!entityType) {
        throw new Error('Failed to create environmentAnimal entity type.');
    }
    const definitions = await ensureAttributeDefinitions();
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            environmentAnimalAttributePath(definition),
            definition,
        ]),
    );
    const appliedNameDefinition = definitionsByPath.get('information.name');
    if (!appliedNameDefinition) {
        throw new Error('Missing information.name definition after upsert.');
    }
    const entityId =
        (await findSlugEntityId(appliedNameDefinition.id)) ??
        (await createEntity(environmentAnimalType.name, actor));

    for (const [path, value] of Object.entries(slugEnvironmentAnimal.values)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} definition after upsert.`);
        }
        const current = await existingValue(entityId, definition.id);
        if (current?.value === value) {
            continue;
        }
        await upsertAttributeValue(
            {
                attributeDefinitionId: definition.id,
                entityId,
                entityTypeName: environmentAnimalType.name,
                id: current?.id,
                order: definition.order,
                value,
            },
            actor,
        );
    }
    await updateEntity(
        { id: entityId, state: slugEnvironmentAnimal.state },
        actor,
    );
    console.log(
        JSON.stringify(
            {
                action: 'applied',
                readback: await readback(entityId, definitions),
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
