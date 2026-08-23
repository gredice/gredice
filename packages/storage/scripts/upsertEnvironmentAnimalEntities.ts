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
    label: 'Životinje okoliša',
    name: 'environmentAnimal',
    order: 'a',
};

const attributeCategories = [
    { label: 'Informacije', name: 'information', order: 'a' },
    { label: 'Stanište', name: 'habitat', order: 'b' },
    { label: 'Pojavljivanje', name: 'spawn', order: 'c' },
    { label: 'Ponašanje', name: 'behavior', order: 'd' },
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
] as const;

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

const obsoleteAttributePaths = new Set(['commerce.purchasable', 'spawn.mode']);

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

async function findFrogEntityId(nameDefinitionId: number) {
    const [frog] = await storage()
        .select({ id: entities.id })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, entityType.name),
                eq(entities.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.value, 'Frog'),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(1);
    return frog?.id ?? null;
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
    const frogId = nameDefinition
        ? await findFrogEntityId(nameDefinition.id)
        : null;

    console.log(
        JSON.stringify(
            {
                action: frogId ? 'update' : 'create',
                entityId: frogId,
                entityTypeExists: Boolean(existingType),
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
                target: 'development-only environmentAnimal/Frog',
            },
            null,
            2,
        ),
    );
}

async function applyAndReadBack() {
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

    let entityId = await findFrogEntityId(nameDefinition.id);
    const created = entityId === null;
    if (entityId === null) {
        entityId = await createEntity(entityType.name, actor);
    }

    let changedAttributeCount = 0;
    for (const [path, expected] of Object.entries(frogAttributes)) {
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
        throw new Error(`Frog entity ${entityId} was not published.`);
    }

    for (const [path, expected] of Object.entries(frogAttributes)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} during readback.`);
        }
        const value = await findAttributeValue(entityId, definition.id);
        if (value?.value !== expected) {
            throw new Error(
                `Unexpected ${path}: ${value?.value ?? 'missing'} (expected ${expected}).`,
            );
        }
    }

    console.log(
        JSON.stringify(
            {
                attributeCount: Object.keys(frogAttributes).length,
                changedAttributeCount,
                created,
                entityId,
                entityType: entityType.name,
                environment: 'development',
                name: 'Frog',
                state: readback.state,
                verified: true,
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
