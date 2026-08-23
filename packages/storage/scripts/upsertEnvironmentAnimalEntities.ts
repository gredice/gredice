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
} from '../src';
import {
    environmentAnimalEntityTypeName,
    ladybugEnvironmentAnimal,
} from '../src/data/environmentAnimalDirectory';

type AttributeConfig = {
    category: string;
    dataType: string;
    display?: boolean;
    label: string;
    name: string;
    order: string;
    required?: boolean;
    unit?: string;
};

type ApplyEnvironment = 'development' | 'preview' | 'production' | 'staging';

const actor = {
    id: 'codex',
    name: 'Environment animal directory upsert',
};

const entityTypeConfig = {
    icon: 'Bug',
    isRoot: true,
    label: 'Životinja iz okoliša',
    name: environmentAnimalEntityTypeName,
    order: 'la',
};

const categoryConfigs = [
    { name: 'information', label: 'Informacije', order: 'a' },
    { name: 'habitat', label: 'Pojavljivanje', order: 'b' },
    { name: 'behavior', label: 'Ponašanje', order: 'c' },
    { name: 'image', label: 'Slika', order: 'z' },
] as const;

const attributeConfigs: AttributeConfig[] = [
    {
        category: 'information',
        dataType: 'text',
        display: true,
        label: 'Sistemski naziv',
        name: 'name',
        order: 'aa',
        required: true,
    },
    {
        category: 'information',
        dataType: 'text',
        display: true,
        label: 'Naziv',
        name: 'label',
        order: 'ab',
        required: true,
    },
    {
        category: 'information',
        dataType: 'text',
        display: true,
        label: 'Kratki opis',
        name: 'shortDescription',
        order: 'ac',
        required: true,
    },
    {
        category: 'information',
        dataType: 'markdown',
        label: 'Opis',
        name: 'fullDescription',
        order: 'ad',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'text',
        display: true,
        label: 'Način pojavljivanja',
        name: 'spawnMode',
        order: 'ba',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'text',
        display: true,
        label: 'Prikladne biljke',
        name: 'hosts',
        order: 'bb',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'number',
        label: 'Najniža temperatura',
        name: 'minimumTemperature',
        order: 'bc',
        required: true,
        unit: '°C',
    },
    {
        category: 'habitat',
        dataType: 'number',
        label: 'Najviša temperatura',
        name: 'maximumTemperature',
        order: 'bd',
        required: true,
        unit: '°C',
    },
    {
        category: 'habitat',
        dataType: 'text',
        label: 'Dio dana',
        name: 'timeOfDay',
        order: 'be',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'text',
        label: 'Trajanje pojave',
        name: 'persistence',
        order: 'bf',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'markdown',
        display: true,
        label: 'Kretanje',
        name: 'movement',
        order: 'ca',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'text',
        display: true,
        label: 'Utjecaj na usjev',
        name: 'cropImpact',
        order: 'cb',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'boolean',
        display: true,
        label: 'Može se kupiti',
        name: 'purchasable',
        order: 'cc',
        required: true,
    },
    {
        category: 'image',
        dataType: 'image',
        display: true,
        label: 'Slika',
        name: 'cover',
        order: 'za',
    },
];

function parseOptions(argv: string[]) {
    let apply = false;
    let allowProduction = false;
    let environment: ApplyEnvironment | null = null;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--') continue;
        if (argument === '--apply') {
            apply = true;
            continue;
        }
        if (argument === '--allow-production') {
            allowProduction = true;
            continue;
        }
        if (argument === '--environment') {
            const value = argv[index + 1];
            if (
                value !== 'development' &&
                value !== 'preview' &&
                value !== 'production' &&
                value !== 'staging'
            ) {
                throw new Error(
                    '--environment requires development, preview, staging, or production.',
                );
            }
            environment = value;
            index += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }

    if (apply && !environment) {
        throw new Error('--apply requires an explicit --environment.');
    }
    if (environment === 'production' && !allowProduction) {
        throw new Error(
            'Production writes require the additional --allow-production guard.',
        );
    }
    if (allowProduction && environment !== 'production') {
        throw new Error('--allow-production is only valid for production.');
    }

    return { allowProduction, apply, environment };
}

function attributePath(
    definition: Pick<SelectAttributeDefinition, 'category' | 'name'>,
) {
    return `${definition.category}.${definition.name}`;
}

function configChanged(
    current: Record<string, unknown>,
    expected: Record<string, unknown>,
) {
    return Object.entries(expected).some(
        ([key, value]) => current[key] !== (value ?? null),
    );
}

async function findEnvironmentAnimal(nameDefinitionId: number) {
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
                eq(attributeValues.value, ladybugEnvironmentAnimal.name),
            ),
        )
        .limit(2);

    if (matches.length > 1) {
        throw new Error('Multiple active Ladybug environment animals found.');
    }
    return matches[0] ?? null;
}

async function getStoredValue(entityId: number, definitionId: number) {
    return storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, definitionId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function ensureStructure(apply: boolean) {
    const contentCategory = (await getEntityTypeCategories()).find(
        (category) => category.name === 'content',
    );
    if (!contentCategory) {
        throw new Error('Missing content entity-type category.');
    }

    let entityType = await getEntityTypeByName(environmentAnimalEntityTypeName);
    const expectedEntityType = {
        ...entityTypeConfig,
        categoryId: contentCategory.id,
    };
    const entityTypeAction = !entityType
        ? 'create'
        : configChanged(entityType, expectedEntityType)
          ? 'update'
          : 'unchanged';

    if (apply && entityTypeAction !== 'unchanged') {
        await upsertEntityType(
            entityType
                ? { id: entityType.id, ...expectedEntityType }
                : expectedEntityType,
        );
        entityType = await getEntityTypeByName(environmentAnimalEntityTypeName);
    }
    if (apply && !entityType) {
        throw new Error('Failed to upsert environmentAnimal entity type.');
    }

    const existingCategories = entityType
        ? await getAttributeDefinitionCategories(
              environmentAnimalEntityTypeName,
          )
        : [];
    const categoryActions: Record<string, string> = {};
    for (const config of categoryConfigs) {
        const current = existingCategories.find(
            (category) => category.name === config.name,
        );
        const expected = {
            ...config,
            entityTypeName: environmentAnimalEntityTypeName,
        };
        const action = !current
            ? 'create'
            : configChanged(current, expected)
              ? 'update'
              : 'unchanged';
        categoryActions[config.name] = action;
        if (!apply || action === 'unchanged') continue;
        if (current) {
            await updateAttributeDefinitionCategory({
                id: current.id,
                ...expected,
            });
        } else {
            await createAttributeDefinitionCategory(expected);
        }
    }

    const existingDefinitions = entityType
        ? await getAttributeDefinitions(environmentAnimalEntityTypeName)
        : [];
    const definitionActions: Record<string, string> = {};
    for (const config of attributeConfigs) {
        const path = attributePath(config);
        const current = existingDefinitions.find(
            (definition) => attributePath(definition) === path,
        );
        const expected = {
            ...config,
            entityTypeName: environmentAnimalEntityTypeName,
        };
        const action = !current
            ? 'create'
            : configChanged(current, expected)
              ? 'update'
              : 'unchanged';
        definitionActions[path] = action;
        if (!apply || action === 'unchanged') continue;
        if (current) {
            await updateAttributeDefinition({ id: current.id, ...expected });
        } else {
            await createAttributeDefinition(expected);
        }
    }

    return { categoryActions, definitionActions, entityTypeAction };
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    const structure = await ensureStructure(options.apply);
    const definitions = await getAttributeDefinitions(
        environmentAnimalEntityTypeName,
    );
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const nameDefinition = definitionsByPath.get('information.name');
    let entity = nameDefinition
        ? await findEnvironmentAnimal(nameDefinition.id)
        : null;
    let entityId = entity?.id ?? null;
    const changedAttributes: string[] = [];

    for (const [path, expectedValue] of Object.entries(
        ladybugEnvironmentAnimal.attributes,
    )) {
        const definition = definitionsByPath.get(path);
        const existingValue =
            entityId && definition
                ? await getStoredValue(entityId, definition.id)
                : null;
        if (existingValue?.value !== expectedValue) {
            changedAttributes.push(path);
        }
    }

    const publish =
        entity?.state !== 'published' || entity?.publishedAt === null;
    const entityAction = !entity
        ? 'create'
        : changedAttributes.length > 0 || publish
          ? 'update'
          : 'unchanged';

    if (options.apply) {
        const missingDefinitions = Object.keys(
            ladybugEnvironmentAnimal.attributes,
        ).filter((path) => !definitionsByPath.has(path));
        if (missingDefinitions.length > 0 || !nameDefinition) {
            throw new Error(
                `Missing environmentAnimal definitions: ${missingDefinitions.join(', ')}`,
            );
        }
        if (!entityId) {
            entityId = await createEntity(
                environmentAnimalEntityTypeName,
                actor,
            );
        }

        const orderedEntries = Object.entries(
            ladybugEnvironmentAnimal.attributes,
        ).sort(([left], [right]) =>
            left === 'information.name'
                ? -1
                : right === 'information.name'
                  ? 1
                  : left.localeCompare(right),
        );
        for (const [path, expectedValue] of orderedEntries) {
            const definition = definitionsByPath.get(path);
            if (!definition) throw new Error(`Missing ${path}.`);
            const current = await getStoredValue(entityId, definition.id);
            if (current?.value === expectedValue) continue;
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

        entity = await findEnvironmentAnimal(nameDefinition.id);
        if (
            !entity ||
            entity.id !== entityId ||
            entity.state !== 'published' ||
            entity.publishedAt === null
        ) {
            throw new Error('Ladybug directory readback failed to publish.');
        }
        for (const [path, expectedValue] of Object.entries(
            ladybugEnvironmentAnimal.attributes,
        )) {
            const definition = definitionsByPath.get(path);
            if (!definition) throw new Error(`Missing ${path} in readback.`);
            const stored = await getStoredValue(entity.id, definition.id);
            if (stored?.value !== expectedValue) {
                throw new Error(`Ladybug readback mismatch for ${path}.`);
            }
        }
    }

    const databaseUrl = new URL(
        process.env.POSTGRES_URL ?? 'postgres://missing',
    );
    console.log(
        JSON.stringify(
            {
                database: {
                    database: databaseUrl.pathname.slice(1),
                    hostname: databaseUrl.hostname,
                },
                entity: {
                    action: entityAction,
                    changedAttributes,
                    id: entityId,
                    published:
                        entity?.state === 'published' &&
                        entity.publishedAt !== null,
                },
                environment: options.environment,
                mode: options.apply ? 'apply' : 'dry-run',
                structure,
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
