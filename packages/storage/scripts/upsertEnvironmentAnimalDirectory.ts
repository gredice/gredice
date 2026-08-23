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
    type SelectAttributeDefinition,
    storage,
    updateAttributeDefinition,
    updateAttributeDefinitionCategory,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    upsertEntityTypeCategory,
} from '../src';
import { assertDevelopmentDatabaseIsAllowlisted } from './lib/developmentDatabaseGuard';
import {
    butterflyEnvironmentAnimal,
    environmentAnimalAttributeCategories,
    environmentAnimalAttributeDefinitions,
    environmentAnimalAttributePath,
    environmentAnimalEntityType,
    environmentAnimalEntityTypeCategory,
    environmentAnimalEntityTypeName,
} from './lib/environmentAnimalDirectory';

// This directory type describes wildlife that appears because of the garden
// environment. It deliberately does not feed inventory or the Ljubimci picker.
// Dry-run is the default. Applying requires two explicit development-only
// acknowledgements so a production connection cannot be changed accidentally.

const actor = { id: 'codex', name: 'Codex' };

type Options = {
    apply: boolean;
    environment: 'development' | null;
};

function parseOptions(argv: string[]): Options {
    let apply = false;
    let environment: Options['environment'] = null;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--') continue;
        if (argument === '--apply') {
            apply = true;
            continue;
        }
        if (argument === '--environment') {
            const value = argv[index + 1];
            if (value !== 'development') {
                throw new Error(
                    '--environment only accepts the safe target development.',
                );
            }
            environment = value;
            index += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }

    return { apply, environment };
}

function assertDevelopmentWriteIsExplicit(options: Options) {
    if (!options.apply) return;
    if (options.environment !== 'development') {
        throw new Error(
            '--apply requires --environment development. Production writes are intentionally unsupported.',
        );
    }
    if (process.env.GREDICE_ALLOW_DEVELOPMENT_WRITES !== '1') {
        throw new Error('--apply requires GREDICE_ALLOW_DEVELOPMENT_WRITES=1.');
    }

    const connection =
        process.env.POSTGRES_URL ??
        process.env.DATABASE_URL ??
        process.env.POSTGRES_PRISMA_URL ??
        '';
    if (!connection) {
        throw new Error('A Postgres connection is required.');
    }
    assertDevelopmentDatabaseIsAllowlisted({
        allowedFingerprints:
            process.env.GREDICE_DEVELOPMENT_DATABASE_FINGERPRINTS,
        connection,
    });
}

function orderedAttributeEntries(attributes: Record<string, string>) {
    return Object.entries(attributes).sort(([leftPath], [rightPath]) => {
        const leftIsName = leftPath === 'information.name';
        const rightIsName = rightPath === 'information.name';
        return Number(rightIsName) - Number(leftIsName);
    });
}

async function findEnvironmentAnimal(
    nameDefinition: SelectAttributeDefinition | undefined,
) {
    if (!nameDefinition) return null;
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
                eq(attributeValues.attributeDefinitionId, nameDefinition.id),
                eq(attributeValues.value, butterflyEnvironmentAnimal.name),
            ),
        )
        .limit(2);

    if (matches.length > 1) {
        throw new Error('Multiple active Butterfly directory entities found.');
    }
    return matches[0] ?? null;
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
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, attributeDefinitionId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    assertDevelopmentWriteIsExplicit(options);

    let typeCategory = (await getEntityTypeCategories()).find(
        ({ name }) => name === environmentAnimalEntityType.categoryName,
    );
    const categoryAction = typeCategory ? 'unchanged' : 'create';
    if (options.apply && categoryAction !== 'unchanged') {
        await upsertEntityTypeCategory(
            typeCategory
                ? {
                      id: typeCategory.id,
                      ...environmentAnimalEntityTypeCategory,
                  }
                : environmentAnimalEntityTypeCategory,
        );
        typeCategory = (await getEntityTypeCategories()).find(
            ({ name }) => name === environmentAnimalEntityType.categoryName,
        );
    }
    if (!typeCategory && options.apply) {
        throw new Error('Failed to create the garden-environment category.');
    }

    let entityType = await getEntityTypeByName(environmentAnimalEntityTypeName);
    const expectedEntityType = {
        name: environmentAnimalEntityType.name,
        label: environmentAnimalEntityType.label,
        icon: environmentAnimalEntityType.icon,
        categoryId: typeCategory?.id ?? null,
        order: environmentAnimalEntityType.order,
        isRoot: true,
    };
    const entityTypeAction = entityType ? 'unchanged' : 'create';

    if (options.apply && entityTypeAction !== 'unchanged') {
        await upsertEntityType(
            entityType
                ? { id: entityType.id, ...expectedEntityType }
                : expectedEntityType,
        );
        entityType = await getEntityTypeByName(environmentAnimalEntityTypeName);
    }

    const existingCategories = entityType
        ? await getAttributeDefinitionCategories(
              environmentAnimalEntityTypeName,
          )
        : [];
    const categoryActions: Record<string, string> = {};
    for (const category of environmentAnimalAttributeCategories) {
        const existing = existingCategories.find(
            (candidate) =>
                candidate.name === category.name && !candidate.isDeleted,
        );
        const expected = {
            entityTypeName: environmentAnimalEntityTypeName,
            name: category.name,
            label: category.label,
            order: category.order,
        };
        const action = existing ? 'unchanged' : 'create';
        categoryActions[category.name] = action;
        if (!options.apply || action === 'unchanged') continue;
        if (existing) {
            await updateAttributeDefinitionCategory({
                id: existing.id,
                ...expected,
            });
        } else {
            await createAttributeDefinitionCategory(expected);
        }
    }

    let definitions = entityType
        ? await getAttributeDefinitions(environmentAnimalEntityTypeName)
        : [];
    const definitionActions: Record<string, string> = {};
    for (const definition of environmentAnimalAttributeDefinitions) {
        const path = environmentAnimalAttributePath(definition);
        const existing = definitions.find(
            (candidate) => environmentAnimalAttributePath(candidate) === path,
        );
        const expected = {
            ...definition,
            entityTypeName: environmentAnimalEntityTypeName,
        };
        const action = existing ? 'unchanged' : 'create';
        definitionActions[path] = action;
        if (!options.apply || action === 'unchanged') continue;
        if (existing) {
            await updateAttributeDefinition({ id: existing.id, ...expected });
        } else {
            await createAttributeDefinition(expected);
        }
    }

    if (options.apply) {
        definitions = await getAttributeDefinitions(
            environmentAnimalEntityTypeName,
        );
    }
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            environmentAnimalAttributePath(definition),
            definition,
        ]),
    );
    const nameDefinition = definitionsByPath.get('information.name');
    let entity = await findEnvironmentAnimal(nameDefinition);
    let entityId = entity?.id ?? null;
    const changedAttributes: string[] = [];

    for (const [path, expectedValue] of Object.entries(
        butterflyEnvironmentAnimal.attributes,
    )) {
        const definition = definitionsByPath.get(path);
        if (!entityId || !definition) {
            changedAttributes.push(path);
            continue;
        }
        const existingValue = await getExistingAttributeValue({
            attributeDefinitionId: definition.id,
            entityId,
        });
        if (existingValue?.value !== expectedValue) {
            changedAttributes.push(path);
        }
    }
    const publish =
        entity?.state !== 'published' || entity.publishedAt === null;
    const entityAction = !entity
        ? 'create'
        : changedAttributes.length > 0 || publish
          ? 'update'
          : 'unchanged';

    if (options.apply) {
        if (!entityId) {
            entityId = await createEntity(
                environmentAnimalEntityTypeName,
                actor,
            );
        }
        for (const [path, expectedValue] of orderedAttributeEntries(
            butterflyEnvironmentAnimal.attributes,
        )) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                throw new Error(`Missing ${path} after schema upsert.`);
            }
            const existingValue = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId,
            });
            if (existingValue?.value === expectedValue) continue;
            await upsertAttributeValue(
                {
                    id: existingValue?.id,
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

        entity = await findEnvironmentAnimal(nameDefinition);
        if (
            !entity ||
            entity.id !== entityId ||
            entity.state !== 'published' ||
            entity.publishedAt === null
        ) {
            throw new Error('Butterfly directory readback failed.');
        }
        for (const [path, expectedValue] of Object.entries(
            butterflyEnvironmentAnimal.attributes,
        )) {
            const definition = definitionsByPath.get(path);
            if (!definition) throw new Error(`Missing ${path} in readback.`);
            const value = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId,
            });
            if (value?.value !== expectedValue) {
                throw new Error(`Unexpected Butterfly value for ${path}.`);
            }
        }
    }

    console.log(
        JSON.stringify(
            {
                mode: options.apply ? 'apply-development' : 'dry-run',
                entityTypeCategory: {
                    name: environmentAnimalEntityType.categoryName,
                    action: categoryAction,
                },
                entityType: {
                    name: environmentAnimalEntityTypeName,
                    action: entityTypeAction,
                },
                attributeCategories: categoryActions,
                attributeDefinitions: definitionActions,
                entity: {
                    name: butterflyEnvironmentAnimal.name,
                    id: entityId,
                    action: entityAction,
                    changedAttributes,
                    publish,
                },
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
