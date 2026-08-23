import { and, eq } from 'drizzle-orm';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
    attributeValues,
    closeStorage,
    createEntity,
    entities,
    entityTypeCategories,
    entityTypes,
    type SelectAttributeDefinition,
    storage,
    updateEntity,
    upsertAttributeValue,
} from '../src';
import { assertEnvironmentAnimalDevelopmentDatabase } from './environmentAnimalDatabaseGuard';
import {
    batEnvironmentAnimal,
    environmentAnimalEntityTypeName,
} from './lib/environmentAnimalDirectory';

const actor = {
    id: 'environment-animal-directory-upsert',
    name: 'Environment animal directory upsert',
};

const entityTypeCategory = {
    icon: 'leaf',
    label: 'Vrt i okoliš',
    name: 'garden-environment',
    order: 'w',
};

const entityType = {
    icon: 'PawPrint',
    label: 'Životinje okoliša',
    name: environmentAnimalEntityTypeName,
    order: 'a',
};

const attributeCategories = [
    { label: 'Informacije', name: 'information', order: 'a' },
    { label: 'Stanište', name: 'habitat', order: 'b' },
    { label: 'Aktivnost', name: 'activity', order: 'c' },
    { label: 'Vrijeme', name: 'weather', order: 'd' },
    { label: 'Pojavljivanje', name: 'spawn', order: 'e' },
    { label: 'Ponašanje', name: 'behavior', order: 'f' },
    { label: 'Model', name: 'model', order: 'g' },
] as const;

const attributeSpecs = [
    {
        category: 'information',
        dataType: 'text',
        display: true,
        label: 'Naziv',
        name: 'name',
        order: 'aa',
        required: true,
    },
    {
        category: 'information',
        dataType: 'text',
        display: true,
        label: 'Javni naziv',
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
        display: false,
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
        display: false,
        label: 'Prikladne biljke',
        name: 'hosts',
        order: 'bb',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'number',
        display: false,
        label: 'Najniža temperatura',
        name: 'minimumTemperature',
        order: 'bc',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'number',
        display: false,
        label: 'Najviša temperatura',
        name: 'maximumTemperature',
        order: 'bd',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'text',
        display: false,
        label: 'Dio dana',
        name: 'timeOfDay',
        order: 'be',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'text',
        display: false,
        label: 'Trajanje pojave',
        name: 'persistence',
        order: 'bf',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'text',
        display: true,
        label: 'Uvjet staništa',
        name: 'eligibility',
        order: 'bg',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'text',
        display: false,
        label: 'Dopušteni tereni',
        name: 'allowedTerrain',
        order: 'bh',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'number',
        display: false,
        label: 'Najveća dubina vode',
        name: 'maxWaterDepth',
        order: 'bi',
        required: true,
    },
    {
        category: 'spawn',
        dataType: 'number',
        display: false,
        label: 'Najveća populacija',
        name: 'maxPopulation',
        order: 'ca',
        required: true,
    },
    {
        category: 'spawn',
        dataType: 'number',
        display: false,
        label: 'Najveća populacija po staništu',
        name: 'maxPopulationPerHabitat',
        order: 'cb',
        required: true,
    },
    {
        category: 'spawn',
        dataType: 'number',
        display: false,
        label: 'Najkraća stanka pojavljivanja',
        name: 'cooldownMinSeconds',
        order: 'cc',
        required: true,
    },
    {
        category: 'spawn',
        dataType: 'number',
        display: false,
        label: 'Najduža stanka pojavljivanja',
        name: 'cooldownMaxSeconds',
        order: 'cd',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'markdown',
        display: true,
        label: 'Kretanje',
        name: 'movement',
        order: 'da',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'text',
        display: true,
        label: 'Utjecaj na usjev',
        name: 'cropImpact',
        order: 'db',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'boolean',
        display: true,
        label: 'Može se kupiti',
        name: 'purchasable',
        order: 'dc',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'text',
        display: false,
        label: 'Animacijska stanja',
        name: 'animationStates',
        order: 'dd',
        required: true,
    },
    {
        category: 'behavior',
        dataType: 'text',
        display: false,
        label: 'Reakcija na lika',
        name: 'avatarReaction',
        order: 'de',
        required: true,
    },
    {
        category: 'habitat',
        dataType: 'number',
        display: false,
        label: 'Najmanja površina staništa',
        name: 'minimumCells',
        order: 'bj',
        required: false,
    },
    {
        category: 'activity',
        dataType: 'number',
        display: false,
        label: 'Kraj aktivnosti u zoru',
        name: 'dawnEnd',
        order: 'ca',
        required: false,
    },
    {
        category: 'activity',
        dataType: 'number',
        display: false,
        label: 'Početak aktivnosti u sumrak',
        name: 'duskStart',
        order: 'cb',
        required: false,
    },
    ...[
        ['maxFog', 'Najveća magla'],
        ['maxRain', 'Najveća kiša'],
        ['maxSnow', 'Najveći snijeg'],
        ['maxThunder', 'Najveća grmljavina'],
        ['maxWindSpeed', 'Najveća brzina vjetra'],
    ].map(([name, label], index) => ({
        category: 'weather',
        dataType: 'number',
        display: false,
        label,
        name,
        order: `d${String.fromCharCode(97 + index)}`,
        required: false,
    })),
    {
        category: 'spawn',
        dataType: 'number',
        display: false,
        label: 'Najviše skupina u sceni',
        name: 'maxGroupsPerScene',
        order: 'ce',
        required: false,
    },
    {
        category: 'spawn',
        dataType: 'number',
        display: false,
        label: 'Najveća ukupna populacija',
        name: 'maxGlobal',
        order: 'cf',
        required: false,
    },
    {
        category: 'behavior',
        dataType: 'boolean',
        display: true,
        label: 'Može se postaviti',
        name: 'placeable',
        order: 'df',
        required: false,
    },
    {
        category: 'model',
        dataType: 'text',
        display: false,
        label: 'Model u registru igre',
        name: 'assetName',
        order: 'ga',
        required: false,
    },
] as const;

const frogAttributes = {
    'behavior.animationStates': 'Frog_Idle,Frog_Blink,Frog_Hop,Frog_Croak',
    'behavior.avatarReaction': 'quick-safe-hop-away',
    'behavior.cropImpact': 'neutralan-koristan',
    'behavior.movement':
        'Čuči i mirno diše, povremeno trepće ili zakrekeće. Kreće se lukovima skoka uz pripremu i doskok, prednost daje plitkoj vodi te brzo i sigurno odskače od lika bez prolaska kroz prepreke.',
    'behavior.placeable': 'false',
    'behavior.purchasable': 'false',
    'habitat.allowedTerrain':
        'Block_Swamp_Ground,Block_Swamp_Ground_Angle,Block_Swamp_Water',
    'habitat.eligibility': 'swamp-wetland',
    'habitat.hosts': 'Nije vezana uz određenu biljku.',
    'habitat.maximumTemperature': '32',
    'habitat.maxWaterDepth': '1.35',
    'habitat.minimumTemperature': '5',
    'habitat.persistence': 'Dok postoji povezano prikladno močvarno stanište.',
    'habitat.spawnMode': 'environment',
    'habitat.timeOfDay': 'jutro,dan,večer,noć',
    'information.fullDescription':
        'Žaba je samonikla životinja močvarnog dijela vrta. Miruje u čučnju, diše i trepće, povremeno napuše grlo i zakrekeće te skače između sigurnih vlažnih mjesta i plitke vode. Ako joj se lik previše približi, brzo će odskočiti na prohodno mjesto. Ne može se kupiti ni odabrati među ljubimcima.',
    'information.label': 'Žaba',
    'information.name': 'Frog',
    'information.shortDescription':
        'Samosvojna močvarna žaba koja voli plitku vodu i sigurno odskače od prolaznika.',
    'model.assetName': 'Frog',
    'spawn.cooldownMaxSeconds': '32',
    'spawn.cooldownMinSeconds': '18',
    'spawn.maxPopulation': '3',
    'spawn.maxPopulationPerHabitat': '2',
} satisfies Record<string, string>;

const environmentAnimals = [
    { attributes: frogAttributes, name: 'Frog' },
    batEnvironmentAnimal,
] as const;

const obsoleteAttributePaths = new Set(['commerce.purchasable', 'spawn.mode']);
const legacyEnvironmentAnimalEntityTypeName = 'environment-animal';

function parseOptions(argv: string[]) {
    let apply = false;
    let environment: string | null = null;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--') {
            continue;
        }
        if (argument === '--apply') {
            apply = true;
            continue;
        }
        if (argument === '--environment') {
            environment = argv[index + 1] ?? null;
            index += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }

    if (apply && environment !== 'development') {
        throw new Error(
            'Writes are allowed only with --apply --environment development. This helper intentionally has no production write mode.',
        );
    }
    if (environment && environment !== 'development') {
        throw new Error(`Unsupported environment: ${environment}`);
    }

    return { apply, environment };
}

function attributePath(
    definition: Pick<SelectAttributeDefinition, 'category' | 'name'>,
) {
    return `${definition.category}.${definition.name}`;
}

async function ensureEntityTypeCategory() {
    const existing = await storage().query.entityTypeCategories.findFirst({
        where: eq(entityTypeCategories.name, entityTypeCategory.name),
    });
    if (existing) {
        await storage()
            .update(entityTypeCategories)
            .set({ ...entityTypeCategory, isDeleted: false })
            .where(eq(entityTypeCategories.id, existing.id));
        return existing.id;
    }

    const [created] = await storage()
        .insert(entityTypeCategories)
        .values(entityTypeCategory)
        .returning({ id: entityTypeCategories.id });
    return created.id;
}

async function ensureEntityType(categoryId: number) {
    const existing = await storage().query.entityTypes.findFirst({
        where: eq(entityTypes.name, entityType.name),
    });
    if (existing) {
        await storage()
            .update(entityTypes)
            .set({
                ...entityType,
                categoryId,
                isDeleted: false,
                isRoot: true,
            })
            .where(eq(entityTypes.id, existing.id));
        return existing.id;
    }

    const [created] = await storage()
        .insert(entityTypes)
        .values({ ...entityType, categoryId, isRoot: true })
        .returning({ id: entityTypes.id });
    return created.id;
}

async function ensureAttributeCategories() {
    for (const category of attributeCategories) {
        const existing =
            await storage().query.attributeDefinitionCategories.findFirst({
                where: and(
                    eq(
                        attributeDefinitionCategories.entityTypeName,
                        entityType.name,
                    ),
                    eq(attributeDefinitionCategories.name, category.name),
                ),
            });
        if (existing) {
            await storage()
                .update(attributeDefinitionCategories)
                .set({ ...category, isDeleted: false })
                .where(eq(attributeDefinitionCategories.id, existing.id));
            continue;
        }
        await storage()
            .insert(attributeDefinitionCategories)
            .values({
                ...category,
                entityTypeName: entityType.name,
            });
    }
}

async function ensureAttributeDefinitions() {
    const definitions: SelectAttributeDefinition[] = [];
    for (const spec of attributeSpecs) {
        const existing = await storage().query.attributeDefinitions.findFirst({
            where: and(
                eq(attributeDefinitions.entityTypeName, entityType.name),
                eq(attributeDefinitions.category, spec.category),
                eq(attributeDefinitions.name, spec.name),
            ),
        });
        const values = {
            ...spec,
            entityTypeName: entityType.name,
            isDeleted: false,
            multiple: false,
        };
        if (existing) {
            await storage()
                .update(attributeDefinitions)
                .set(values)
                .where(eq(attributeDefinitions.id, existing.id));
            definitions.push({ ...existing, ...values });
            continue;
        }

        const [created] = await storage()
            .insert(attributeDefinitions)
            .values(values)
            .returning();
        definitions.push(created);
    }
    return definitions;
}

async function retireObsoleteDraftDefinitions() {
    const definitions = await storage().query.attributeDefinitions.findMany({
        where: and(
            eq(attributeDefinitions.entityTypeName, entityType.name),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
    for (const definition of definitions) {
        if (!obsoleteAttributePaths.has(attributePath(definition))) {
            continue;
        }
        await storage()
            .update(attributeValues)
            .set({ isDeleted: true })
            .where(eq(attributeValues.attributeDefinitionId, definition.id));
        await storage()
            .update(attributeDefinitions)
            .set({ isDeleted: true })
            .where(eq(attributeDefinitions.id, definition.id));
    }

    await storage()
        .update(attributeDefinitionCategories)
        .set({ isDeleted: true })
        .where(
            and(
                eq(
                    attributeDefinitionCategories.entityTypeName,
                    entityType.name,
                ),
                eq(attributeDefinitionCategories.name, 'commerce'),
            ),
        );
}

async function retireLegacyEnvironmentAnimalDirectory() {
    const legacyType = await storage().query.entityTypes.findFirst({
        where: and(
            eq(entityTypes.name, legacyEnvironmentAnimalEntityTypeName),
            eq(entityTypes.isDeleted, false),
        ),
    });
    if (!legacyType) {
        return { entityCount: 0, retired: false };
    }

    const legacyEntities = await storage()
        .select({ id: entities.id })
        .from(entities)
        .where(
            and(
                eq(
                    entities.entityTypeName,
                    legacyEnvironmentAnimalEntityTypeName,
                ),
                eq(entities.isDeleted, false),
            ),
        );
    await storage()
        .update(attributeValues)
        .set({ isDeleted: true })
        .where(
            eq(
                attributeValues.entityTypeName,
                legacyEnvironmentAnimalEntityTypeName,
            ),
        );
    await storage()
        .update(entities)
        .set({ isDeleted: true })
        .where(
            eq(entities.entityTypeName, legacyEnvironmentAnimalEntityTypeName),
        );
    await storage()
        .update(attributeDefinitions)
        .set({ isDeleted: true })
        .where(
            eq(
                attributeDefinitions.entityTypeName,
                legacyEnvironmentAnimalEntityTypeName,
            ),
        );
    await storage()
        .update(attributeDefinitionCategories)
        .set({ isDeleted: true })
        .where(
            eq(
                attributeDefinitionCategories.entityTypeName,
                legacyEnvironmentAnimalEntityTypeName,
            ),
        );
    await storage()
        .update(entityTypes)
        .set({ isDeleted: true })
        .where(eq(entityTypes.id, legacyType.id));

    return { entityCount: legacyEntities.length, retired: true };
}

async function findEnvironmentAnimalEntityId(
    nameDefinitionId: number,
    name: string,
) {
    const [animal] = await storage()
        .select({ id: entities.id })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, entityType.name),
                eq(entities.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.value, name),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(1);
    return animal?.id ?? null;
}

async function findAttributeValue(entityId: number, definitionId: number) {
    const [value] = await storage()
        .select({ id: attributeValues.id, value: attributeValues.value })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, entityId),
                eq(attributeValues.attributeDefinitionId, definitionId),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(1);
    return value;
}

async function dryRun() {
    const existingType = await storage().query.entityTypes.findFirst({
        where: and(
            eq(entityTypes.name, entityType.name),
            eq(entityTypes.isDeleted, false),
        ),
    });
    const legacyType = await storage().query.entityTypes.findFirst({
        where: and(
            eq(entityTypes.name, legacyEnvironmentAnimalEntityTypeName),
            eq(entityTypes.isDeleted, false),
        ),
    });
    const definitions = await storage().query.attributeDefinitions.findMany({
        where: and(
            eq(attributeDefinitions.entityTypeName, entityType.name),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const nameDefinition = definitionsByPath.get('information.name');
    const animals = await Promise.all(
        environmentAnimals.map(async (animal) => {
            const entityId = nameDefinition
                ? await findEnvironmentAnimalEntityId(
                      nameDefinition.id,
                      animal.name,
                  )
                : null;
            return {
                action: entityId ? 'update' : 'create',
                entityId,
                name: animal.name,
            };
        }),
    );

    console.log(
        JSON.stringify(
            {
                animals,
                entityTypeExists: Boolean(existingType),
                legacyDirectoryAction: legacyType ? 'retire' : 'unchanged',
                missingAttributeDefinitions: attributeSpecs
                    .map((spec) => `${spec.category}.${spec.name}`)
                    .filter((path) => !definitionsByPath.has(path)),
                mode: 'dry-run',
                requiredAttributeDefinitions: definitions
                    .filter((definition) => definition.required)
                    .map((definition) => ({
                        dataType: definition.dataType,
                        label: definition.label,
                        multiple: definition.multiple,
                        path: attributePath(definition),
                    })),
                target: `development-only ${entityType.name}`,
            },
            null,
            2,
        ),
    );
}

async function upsertAnimal(
    animal: (typeof environmentAnimals)[number],
    definitionsByPath: Map<string, SelectAttributeDefinition>,
    nameDefinitionId: number,
) {
    let entityId = await findEnvironmentAnimalEntityId(
        nameDefinitionId,
        animal.name,
    );
    const created = entityId === null;
    if (entityId === null) {
        entityId = await createEntity(entityType.name, actor);
    }

    let changedAttributeCount = 0;
    for (const [path, expected] of Object.entries(animal.attributes)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} definition after upsert.`);
        }
        const existing = await findAttributeValue(entityId, definition.id);
        if (existing?.value === expected) {
            continue;
        }
        await upsertAttributeValue(
            {
                attributeDefinitionId: definition.id,
                entityId,
                entityTypeName: entityType.name,
                id: existing?.id,
                order: definition.order,
                value: expected,
            },
            actor,
        );
        changedAttributeCount += 1;
    }

    await updateEntity({ id: entityId, state: 'published' }, actor);

    const [readback] = await storage()
        .select({
            id: entities.id,
            publishedAt: entities.publishedAt,
            state: entities.state,
        })
        .from(entities)
        .where(
            and(
                eq(entities.id, entityId),
                eq(entities.entityTypeName, entityType.name),
                eq(entities.isDeleted, false),
            ),
        )
        .limit(1);
    if (readback?.state !== 'published' || !readback.publishedAt) {
        throw new Error(`${animal.name} entity ${entityId} was not published.`);
    }

    for (const [path, expected] of Object.entries(animal.attributes)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} during readback.`);
        }
        const value = await findAttributeValue(entityId, definition.id);
        if (value?.value !== expected) {
            throw new Error(
                `Unexpected ${animal.name} ${path}: ${value?.value ?? 'missing'} (expected ${expected}).`,
            );
        }
    }

    return {
        attributeCount: Object.keys(animal.attributes).length,
        changedAttributeCount,
        created,
        entityId,
        name: animal.name,
        state: readback.state,
        verified: true,
    };
}

async function applyAndReadBack() {
    const legacyDirectory = await retireLegacyEnvironmentAnimalDirectory();
    const categoryId = await ensureEntityTypeCategory();
    await ensureEntityType(categoryId);
    await ensureAttributeCategories();
    const definitions = await ensureAttributeDefinitions();
    await retireObsoleteDraftDefinitions();
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const nameDefinition = definitionsByPath.get('information.name');
    if (!nameDefinition) {
        throw new Error('Missing information.name definition after upsert.');
    }
    const animals = [];
    for (const animal of environmentAnimals) {
        animals.push(
            await upsertAnimal(animal, definitionsByPath, nameDefinition.id),
        );
    }

    console.log(
        JSON.stringify(
            {
                animals,
                entityType: entityType.name,
                environment: 'development',
                legacyDirectory,
            },
            null,
            2,
        ),
    );
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    if (!options.apply) {
        await dryRun();
        return;
    }
    if (!process.env.POSTGRES_URL) {
        throw new Error(
            'POSTGRES_URL is required for the guarded development write.',
        );
    }
    assertEnvironmentAnimalDevelopmentDatabase(process.env.POSTGRES_URL);
    await applyAndReadBack();
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
