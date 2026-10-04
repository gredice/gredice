import { and, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    createEntity,
    entities,
    getAttributeDefinitions,
    type SelectAttributeDefinition,
    storage,
    updateEntity,
    upsertAttributeValue,
} from '../src';

const actor = {
    id: 'codex',
    name: 'Codex',
};

const blockName = 'WoodenWalkway';
const entityTypeName = 'block';

const woodenWalkwayAttributes = {
    'attributes.height': '0.1',
    'attributes.hitboxDepth': '1',
    'attributes.hitboxHeight': '0.1',
    'attributes.hitboxWidth': '0.86',
    'attributes.placeableOnWater': 'true',
    'attributes.spanDepth': '1',
    'attributes.spanWidth': '1',
    'attributes.stackable': 'false',
    'attributes.type': 'decoration',
    'functions.raisedBed': 'false',
    'functions.recycler': 'false',
    'information.fullDescription':
        'Jednostavna drvena staza od niskih dasaka koje se mogu slagati jedna do druge. Položi je preko trave, zemlje ili vode i poveži više komada u uredan vrtni puteljak.',
    'information.label': 'Drvena staza',
    'information.name': blockName,
    'information.shortDescription':
        'Ravne drvene daske za stazu preko tla ili uskog vodenog kanala.',
    'prices.sunflowers': '40',
} satisfies Record<string, string>;

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

async function findBlockEntityId(
    nameDefinition: SelectAttributeDefinition,
): Promise<number | null> {
    const [existingEntity] = await storage()
        .select({ id: entities.id })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinition.id),
                eq(attributeValues.value, blockName),
            ),
        )
        .limit(1);

    return existingEntity?.id ?? null;
}

async function getExistingAttributeValue({
    attributeDefinitionId,
    entityId,
}: {
    attributeDefinitionId: number;
    entityId: number;
}) {
    const [existingValue] = await storage()
        .select({
            id: attributeValues.id,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, entityId),
                eq(
                    attributeValues.attributeDefinitionId,
                    attributeDefinitionId,
                ),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(1);

    return existingValue;
}

async function main() {
    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );

    const missingDefinitions = Object.keys(woodenWalkwayAttributes).filter(
        (path) => !definitionsByPath.has(path),
    );
    if (missingDefinitions.length > 0) {
        throw new Error(
            `Missing block attribute definitions: ${missingDefinitions.join(', ')}`,
        );
    }

    const nameDefinition = definitionsByPath.get('information.name');
    if (!nameDefinition) {
        throw new Error('Missing information.name definition.');
    }

    let entityId = await findBlockEntityId(nameDefinition);
    const created = entityId === null;
    if (!entityId) {
        entityId = await createEntity(entityTypeName, actor);
    }

    let changedValueCount = 0;
    for (const [path, value] of Object.entries(woodenWalkwayAttributes)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            continue;
        }

        const existingValue = await getExistingAttributeValue({
            attributeDefinitionId: definition.id,
            entityId,
        });

        if (existingValue?.value === value) {
            continue;
        }

        await upsertAttributeValue(
            {
                id: existingValue?.id,
                attributeDefinitionId: definition.id,
                entityId,
                entityTypeName,
                order: definition.order,
                value,
            },
            actor,
        );
        changedValueCount += 1;
    }

    await updateEntity(
        {
            id: entityId,
            state: 'published',
        },
        actor,
    );

    const [publishedEntity] = await storage()
        .select({
            id: entities.id,
            publishedAt: entities.publishedAt,
            state: entities.state,
        })
        .from(entities)
        .where(
            and(
                eq(entities.id, entityId),
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
            ),
        )
        .limit(1);

    if (
        publishedEntity?.state !== 'published' ||
        publishedEntity.publishedAt === null
    ) {
        throw new Error(
            `Failed to publish ${blockName} block entity ${entityId}.`,
        );
    }

    for (const [path, expectedValue] of Object.entries(
        woodenWalkwayAttributes,
    )) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} during ${blockName} readback.`);
        }
        const storedValue = await getExistingAttributeValue({
            attributeDefinitionId: definition.id,
            entityId,
        });
        if (storedValue?.value !== expectedValue) {
            throw new Error(
                `Unexpected ${path} value for ${blockName}: ${storedValue?.value ?? 'missing'}`,
            );
        }
    }

    console.log(
        `${created ? 'Created' : 'Updated'} ${blockName} block entity ${entityId}. Upserted ${changedValueCount} attributes and verified ${Object.keys(woodenWalkwayAttributes).length} attributes plus published state.`,
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
