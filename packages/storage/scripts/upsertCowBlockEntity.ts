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

const blockName = 'Cow';
const entityTypeName = 'block';

const cowAttributes = {
    'attributes.height': '1.26',
    'attributes.hitboxDepth': '2.08',
    'attributes.hitboxHeight': '1.26',
    'attributes.hitboxWidth': '0.93',
    'attributes.nightOnlyPurchase': 'false',
    'attributes.placeableOnWater': 'false',
    'attributes.spanDepth': '2',
    'attributes.spanWidth': '1',
    'attributes.stackable': 'false',
    'attributes.type': 'decoration',
    'functions.raisedBed': 'false',
    'functions.recycler': 'false',
    'image.cover': imageAttributeValueFromUrl(
        'https://www.gredice.com/assets/blocks/Cow.webp',
    ),
    'information.fullDescription':
        'Smjesti kravu na travnati dio vrta. Mirno će pasti, preživati, prošetati okolicom i držati ugodan razmak od drugih krava.',
    'information.label': 'Krava',
    'information.name': blockName,
    'information.shortDescription':
        'Mirna krava koja pase, preživa i svojim sporim korakom oživljava vrt.',
    'prices.sunflowers': '850',
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
    const matches = await storage()
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
        .limit(2);

    if (matches.length > 1) {
        throw new Error(
            `Multiple active block entities found for ${blockName}.`,
        );
    }

    return matches[0]?.id ?? null;
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
    const apply = parseApplyFlag(process.argv.slice(2));
    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const missingDefinitions = Object.keys(cowAttributes).filter(
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
    const changedAttributes: string[] = [];
    if (existingEntityId) {
        for (const [path, expectedValue] of Object.entries(cowAttributes)) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                continue;
            }
            const storedValue = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId: existingEntityId,
            });
            if (storedValue?.value !== expectedValue) {
                changedAttributes.push(path);
            }
        }
    } else {
        changedAttributes.push(...Object.keys(cowAttributes));
    }

    if (!apply) {
        console.log(
            JSON.stringify(
                {
                    mode: 'dry-run',
                    block: blockName,
                    entityId: existingEntityId,
                    action: existingEntityId ? 'update' : 'create',
                    changedAttributes,
                    publish: true,
                },
                null,
                2,
            ),
        );
        return;
    }

    let entityId = existingEntityId;
    const created = entityId === null;
    if (!entityId) {
        entityId = await createEntity(entityTypeName, actor);
    }

    let changedValueCount = 0;
    const orderedEntries = Object.entries(cowAttributes).sort(
        ([leftPath], [rightPath]) =>
            Number(rightPath === 'information.name') -
            Number(leftPath === 'information.name'),
    );
    for (const [path, value] of orderedEntries) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} while applying ${blockName}.`);
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

    await updateEntity({ id: entityId, state: 'published' }, actor);
    const publishedEntity = await storage().query.entities.findFirst({
        where: and(
            eq(entities.id, entityId),
            eq(entities.entityTypeName, entityTypeName),
            eq(entities.isDeleted, false),
        ),
    });
    if (
        publishedEntity?.state !== 'published' ||
        publishedEntity.publishedAt === null
    ) {
        throw new Error(
            `Failed to publish ${blockName} block entity ${entityId}.`,
        );
    }

    for (const [path, expectedValue] of Object.entries(cowAttributes)) {
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
        `${created ? 'Created' : 'Updated'} ${blockName} block entity ${entityId}. Upserted ${changedValueCount} attributes and verified ${Object.keys(cowAttributes).length} attributes plus published state.`,
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
