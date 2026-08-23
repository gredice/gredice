import { and, eq } from 'drizzle-orm';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
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
import {
    environmentAnimalEntityTypeName,
    ladybugEnvironmentAnimal,
} from '../src/data/environmentAnimalDirectory';
import { assertEnvironmentAnimalDevelopmentDatabase } from './environmentAnimalDatabaseGuard';

type AttributeSpec = {
    category: string;
    dataType: string;
    display: boolean;
    label: string;
    name: string;
    order: string;
    required: boolean;
    unit?: string;
};

type EnvironmentAnimalRecord = {
    attributes: Readonly<Record<string, string>>;
    name: string;
};

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
    icon: 'frog',
    isRoot: true,
    label: 'Životinje okoliša',
    name: environmentAnimalEntityTypeName,
    order: 'a',
};

const attributeCategories = [
    { label: 'Informacije', name: 'information', order: 'a' },
    { label: 'Stanište', name: 'habitat', order: 'b' },
    { label: 'Pojavljivanje', name: 'spawn', order: 'c' },
    { label: 'Ponašanje', name: 'behavior', order: 'd' },
    { label: 'Slika', name: 'image', order: 'z' },
] as const;

const attributeSpecs: AttributeSpec[] = [
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
        unit: '°C',
    },
    {
        category: 'habitat',
        dataType: 'number',
        display: false,
        label: 'Najviša temperatura',
        name: 'maximumTemperature',
        order: 'bd',
        required: true,
        unit: '°C',
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
        category: 'image',
        dataType: 'image',
        display: true,
        label: 'Slika',
        name: 'cover',
        order: 'za',
        required: false,
    },
];

const frogAttributes = {
    'behavior.animationStates': 'Frog_Idle,Frog_Blink,Frog_Hop,Frog_Croak',
    'behavior.avatarReaction': 'quick-safe-hop-away',
    'behavior.cropImpact': 'neutralan-koristan',
    'behavior.movement':
        'Čuči i mirno diše, povremeno trepće ili zakrekeće. Kreće se lukovima skoka uz pripremu i doskok, prednost daje plitkoj vodi te brzo i sigurno odskače od lika bez prolaska kroz prepreke.',
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
    'spawn.cooldownMaxSeconds': '32',
    'spawn.cooldownMinSeconds': '18',
    'spawn.maxPopulation': '3',
    'spawn.maxPopulationPerHabitat': '2',
} satisfies Record<string, string>;

const environmentAnimals: EnvironmentAnimalRecord[] = [
    { attributes: frogAttributes, name: 'Frog' },
    ladybugEnvironmentAnimal,
];

const obsoleteAttributePaths = new Set(['commerce.purchasable', 'spawn.mode']);

function parseOptions(argv: string[]) {
    let apply = false;
    let environment: string | null = null;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--') continue;
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

function configChanged(
    current: Record<string, unknown>,
    expected: Record<string, unknown>,
) {
    return Object.entries(expected).some(
        ([key, value]) => current[key] !== (value ?? null),
    );
}

async function ensureStructure() {
    let category = (await getEntityTypeCategories()).find(
        (candidate) => candidate.name === entityTypeCategory.name,
    );
    if (!category) {
        await upsertEntityTypeCategory(entityTypeCategory);
        category = (await getEntityTypeCategories()).find(
            (candidate) => candidate.name === entityTypeCategory.name,
        );
    } else if (configChanged(category, entityTypeCategory)) {
        await upsertEntityTypeCategory({
            id: category.id,
            ...entityTypeCategory,
            isDeleted: false,
        });
    }
    if (!category) {
        throw new Error('Failed to upsert garden environment category.');
    }

    const currentType = await getEntityTypeByName(entityType.name);
    const expectedType = { ...entityType, categoryId: category.id };
    if (!currentType || configChanged(currentType, expectedType)) {
        await upsertEntityType(
            currentType
                ? { id: currentType.id, ...expectedType, isDeleted: false }
                : expectedType,
        );
    }

    const existingCategories = await getAttributeDefinitionCategories(
        entityType.name,
    );
    for (const expected of attributeCategories) {
        const current = existingCategories.find(
            (candidate) => candidate.name === expected.name,
        );
        const values = { ...expected, entityTypeName: entityType.name };
        if (!current) {
            await createAttributeDefinitionCategory(values);
        } else if (configChanged(current, values)) {
            await updateAttributeDefinitionCategory({
                id: current.id,
                ...values,
            });
        }
    }

    const existingDefinitions = await getAttributeDefinitions(entityType.name);
    for (const expected of attributeSpecs) {
        const current = existingDefinitions.find(
            (candidate) => attributePath(candidate) === attributePath(expected),
        );
        const values = {
            ...expected,
            entityTypeName: entityType.name,
            multiple: false,
        };
        if (!current) {
            await createAttributeDefinition(values);
        } else if (configChanged(current, values)) {
            await updateAttributeDefinition({
                id: current.id,
                ...values,
            });
        }
    }
}

async function retireObsoleteDefinitions() {
    const definitions = await storage().query.attributeDefinitions.findMany({
        where: and(
            eq(attributeDefinitions.entityTypeName, entityType.name),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
    for (const definition of definitions) {
        if (!obsoleteAttributePaths.has(attributePath(definition))) continue;
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

async function findEnvironmentAnimal(nameDefinitionId: number, name: string) {
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
                eq(entities.entityTypeName, entityType.name),
                eq(entities.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.value, name),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(2);
    if (matches.length > 1) {
        throw new Error(`Multiple active ${name} environment animals found.`);
    }
    return matches[0] ?? null;
}

function findAttributeValue(entityId: number, definitionId: number) {
    return storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, definitionId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function inspectAnimal(
    animal: EnvironmentAnimalRecord,
    definitionsByPath: Map<string, SelectAttributeDefinition>,
) {
    const nameDefinition = definitionsByPath.get('information.name');
    const entity = nameDefinition
        ? await findEnvironmentAnimal(nameDefinition.id, animal.name)
        : null;
    const changedAttributes: string[] = [];
    for (const [path, expected] of Object.entries(animal.attributes)) {
        const definition = definitionsByPath.get(path);
        const current =
            entity && definition
                ? await findAttributeValue(entity.id, definition.id)
                : null;
        if (current?.value !== expected) changedAttributes.push(path);
    }

    return {
        action: !entity
            ? 'create'
            : changedAttributes.length > 0 ||
                entity.state !== 'published' ||
                !entity.publishedAt
              ? 'update'
              : 'unchanged',
        changedAttributes,
        entityId: entity?.id ?? null,
        name: animal.name,
    };
}

async function dryRun() {
    const definitions = await getAttributeDefinitions(entityType.name);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const animals = [];
    for (const animal of environmentAnimals) {
        animals.push(await inspectAnimal(animal, definitionsByPath));
    }

    console.log(
        JSON.stringify(
            {
                animals,
                entityTypeExists: Boolean(
                    await getEntityTypeByName(entityType.name),
                ),
                missingAttributeDefinitions: attributeSpecs
                    .map(attributePath)
                    .filter((path) => !definitionsByPath.has(path)),
                mode: 'dry-run',
                target: 'development-only environment animals',
            },
            null,
            2,
        ),
    );
}

async function applyAnimal(
    animal: EnvironmentAnimalRecord,
    definitionsByPath: Map<string, SelectAttributeDefinition>,
) {
    const missingDefinitions = Object.keys(animal.attributes).filter(
        (path) => !definitionsByPath.has(path),
    );
    const nameDefinition = definitionsByPath.get('information.name');
    if (!nameDefinition || missingDefinitions.length > 0) {
        throw new Error(
            `Missing ${animal.name} definitions: ${missingDefinitions.join(', ')}`,
        );
    }

    let entity = await findEnvironmentAnimal(nameDefinition.id, animal.name);
    const created = !entity;
    const entityId = entity?.id ?? (await createEntity(entityType.name, actor));
    let changedAttributeCount = 0;

    const entries = Object.entries(animal.attributes).sort(([left], [right]) =>
        left === 'information.name'
            ? -1
            : right === 'information.name'
              ? 1
              : left.localeCompare(right),
    );
    for (const [path, expected] of entries) {
        const definition = definitionsByPath.get(path);
        if (!definition) throw new Error(`Missing ${path} after upsert.`);
        const current = await findAttributeValue(entityId, definition.id);
        if (current?.value === expected) continue;
        await upsertAttributeValue(
            {
                attributeDefinitionId: definition.id,
                entityId,
                entityTypeName: entityType.name,
                id: current?.id,
                order: definition.order,
                value: expected,
            },
            actor,
        );
        changedAttributeCount += 1;
    }

    await updateEntity({ id: entityId, state: 'published' }, actor);
    entity = await findEnvironmentAnimal(nameDefinition.id, animal.name);
    if (
        !entity ||
        entity.id !== entityId ||
        entity.state !== 'published' ||
        !entity.publishedAt
    ) {
        throw new Error(`${animal.name} directory readback failed.`);
    }

    for (const [path, expected] of entries) {
        const definition = definitionsByPath.get(path);
        if (!definition) throw new Error(`Missing ${path} during readback.`);
        const value = await findAttributeValue(entityId, definition.id);
        if (value?.value !== expected) {
            throw new Error(`${animal.name} readback mismatch for ${path}.`);
        }
    }

    return {
        attributeCount: entries.length,
        changedAttributeCount,
        created,
        entityId,
        name: animal.name,
        state: entity.state,
        verified: true,
    };
}

async function applyAndReadBack() {
    await ensureStructure();
    await retireObsoleteDefinitions();
    const definitions = await getAttributeDefinitions(entityType.name);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const animals = [];
    for (const animal of environmentAnimals) {
        animals.push(await applyAnimal(animal, definitionsByPath));
    }

    console.log(
        JSON.stringify(
            {
                animals,
                entityType: entityType.name,
                environment: 'development',
                mode: 'apply',
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
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
