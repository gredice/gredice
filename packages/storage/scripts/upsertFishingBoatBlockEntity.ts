import { and, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    createEntity,
    entities,
    getAttributeDefinitions,
    imageAttributeValueFromUrl,
    type SelectAttributeDefinition,
    storage,
    updateEntity,
    upsertAttributeValue,
} from '../src';

// Deploy the runtime model and public covers before using --apply. The default
// dry-run prevents the catalog from pointing at assets that are not live yet.

const actor = {
    id: 'codex',
    name: 'Codex',
};

const blockName = 'FishingBoat';
const entityTypeName = 'block';

const fishingBoatAttributes = {
    'attributes.height': '0.62',
    'attributes.hitboxDepth': '1.84',
    'attributes.hitboxHeight': '0.62',
    'attributes.hitboxWidth': '0.94',
    'attributes.nightOnlyPurchase': 'false',
    'attributes.placeableOnWater': 'true',
    'attributes.spanDepth': '2',
    'attributes.spanWidth': '1',
    'attributes.stackable': 'false',
    'attributes.type': 'decoration',
    'functions.raisedBed': 'false',
    'functions.recycler': 'false',
    'image.cover': imageAttributeValueFromUrl(
        'https://www.gredice.com/assets/blocks/FishingBoat.webp',
    ),
    'information.fullDescription':
        'Tamna drvena ribarska barka s dvije klupe, parom vesala, konopom i spremljenom ribarskom mrežom. Postavi je samo na dva povezana polja vode ili močvare. U pogledu lika naciljaj barku i klikni za ukrcaj, a zatim je vozi po vodi.',
    'information.label': 'Ribarska barka',
    'information.name': blockName,
    'information.shortDescription':
        'Tamna drvena barka s dvije klupe, veslima i spremljenom ribarskom mrežom.',
    'prices.sunflowers': '150',
} satisfies Record<string, string>;

function parseApplyFlag(argv: string[]) {
    for (const argument of argv) {
        if (argument !== '--' && argument !== '--apply') {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    return argv.includes('--apply');
}

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
    const apply = parseApplyFlag(process.argv.slice(2));
    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );

    const missingDefinitions = Object.keys(fishingBoatAttributes).filter(
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

    const existingEntityId = await findBlockEntityId(nameDefinition);
    if (!apply) {
        console.log(
            `Dry run: ${blockName} ${existingEntityId ? `entity ${existingEntityId}` : 'entity'} would be ${existingEntityId ? 'updated' : 'created'} with ${Object.keys(fishingBoatAttributes).length} attributes and published. Re-run with --apply only after the model and covers are deployed.`,
        );
        return;
    }

    let entityId = existingEntityId;
    const created = entityId === null;
    if (!entityId) {
        entityId = await createEntity(entityTypeName, actor);
    }

    let changedValueCount = 0;
    for (const [path, value] of Object.entries(fishingBoatAttributes)) {
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

    for (const [path, expectedValue] of Object.entries(fishingBoatAttributes)) {
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
        `${created ? 'Created' : 'Updated'} ${blockName} block entity ${entityId}. Upserted ${changedValueCount} attributes and verified ${Object.keys(fishingBoatAttributes).length} attributes plus published state.`,
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
