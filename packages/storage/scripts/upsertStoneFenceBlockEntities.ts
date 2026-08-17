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

// Deploy the runtime models and public covers before using --apply. The default
// dry-run prevents catalogue entries from pointing at assets that are not live.

const actor = {
    id: 'codex',
    name: 'Codex',
};

const entityTypeName = 'block';

function fenceSpec({
    fullDescription,
    height = '0.68',
    label,
    name,
    price = '5',
    shortDescription,
}: {
    fullDescription: string;
    height?: string;
    label: string;
    name: string;
    price?: string;
    shortDescription: string;
}) {
    return {
        name,
        attributes: {
            'attributes.height': height,
            'attributes.hitboxDepth': '1',
            'attributes.hitboxHeight': height,
            'attributes.hitboxWidth': '1',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                `https://www.gredice.com/assets/blocks/${name}.webp`,
            ),
            'information.fullDescription': fullDescription,
            'information.label': label,
            'information.name': name,
            'information.shortDescription': shortDescription,
            'prices.sunflowers': price,
        },
    };
}

const blockSpecs = [
    fenceSpec({
        name: 'StoneFence',
        label: 'Kamena ograda',
        shortDescription:
            'Ograda od nepravilnog kamena koja se povezuje sa susjednim kamenim dijelovima.',
        fullDescription:
            'Kamena ograda počinje kao čvrst kameni stup. Kada uz nju postaviš isti dio ograde, između stupova nastaje niz nepravilno složenog kamena pa možeš graditi ravne dijelove, kutove i zatvorene ograde.',
    }),
    fenceSpec({
        name: 'PolishedStoneFence',
        label: 'Ograda od poliranog kamena',
        shortDescription:
            'Jednostavna glatka ograda koja se povezuje sa susjednim dijelovima od poliranog kamena.',
        fullDescription:
            'Ograda od poliranog kamena počinje kao jednostavan stup bez ukrasne kape. Susjedni isti dijelovi spajaju se punim glatkim zidom jednake debljine kao stup, za čiste ravne linije, kutove i zatvorene ograde.',
    }),
    fenceSpec({
        name: 'FenceGate',
        label: 'Vrata za drvenu ogradu',
        height: '0.72',
        price: '8',
        shortDescription:
            'Drvena vrtna vrata koja se otvaraju dodirom i propuštaju posjetitelje i životinje.',
        fullDescription:
            'Postavi ova drvena vrata između dijelova ograde. Dodirni ih ili im priđi avatarom kako bi se otvorila, a zatvori ih kada ponovno želiš zaustaviti prolaz kroz ogradu.',
    }),
    fenceSpec({
        name: 'WhiteFenceGate',
        label: 'Vrata za bijelu ogradu',
        height: '0.72',
        price: '8',
        shortDescription:
            'Bijela vrtna vrata koja se otvaraju dodirom i uklapaju u bijelu ogradu.',
        fullDescription:
            'Bijela šiljasta vrata povezuju se s tankom bijelom ogradom. Otvori ih dodirom ili avatarom kako bi ljudi i životinje mogli proći, a zatvori ih za ponovno ograđen prolaz.',
    }),
    fenceSpec({
        name: 'StoneFenceGate',
        label: 'Vrata za kamenu ogradu',
        height: '0.68',
        price: '8',
        shortDescription:
            'Metalna vrtna vrata između stupova od nepravilnog kamena.',
        fullDescription:
            'Čvrsti kameni stupovi nose jednostavna metalna vrata za prolaz kroz kamenu ogradu. Otvorena propuštaju avatare i životinje, a zatvorena ponovno zaustavljaju prolaz.',
    }),
    fenceSpec({
        name: 'PolishedStoneFenceGate',
        label: 'Vrata za ogradu od poliranog kamena',
        height: '0.68',
        price: '8',
        shortDescription:
            'Metalna vrtna vrata između glatkih stupova od poliranog kamena.',
        fullDescription:
            'Glatki kameni stupovi i jednostavno metalno krilo stvaraju uredan prolaz kroz ogradu od poliranog kamena. Vrata se otvaraju dodirom ili avatarom te u otvorenom položaju propuštaju životinje.',
    }),
] satisfies Array<{
    name: string;
    attributes: Record<string, string>;
}>;

function parseOptions(argv: string[]) {
    let apply = false;
    let blockName: string | null = null;
    let gatesOnly = false;
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--') {
            continue;
        }
        if (argument === '--apply') {
            apply = true;
            continue;
        }
        if (argument === '--gates-only') {
            gatesOnly = true;
            continue;
        }
        if (argument === '--name') {
            const value = argv[index + 1];
            if (!value || value.startsWith('--')) {
                throw new Error('--name requires an exact block name.');
            }
            blockName = value;
            index += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }
    return { apply, blockName, gatesOnly };
}

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

function orderedAttributeEntries(attributes: Record<string, string>) {
    return Object.entries(attributes).sort(([leftPath], [rightPath]) => {
        const leftIsName = leftPath === 'information.name';
        const rightIsName = rightPath === 'information.name';
        return Number(rightIsName) - Number(leftIsName);
    });
}

async function findBlockEntity(nameDefinitionId: number, blockName: string) {
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
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.value, blockName),
            ),
        )
        .limit(2);

    if (matches.length > 1) {
        throw new Error(
            `Multiple active block entities found for ${blockName}.`,
        );
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
    const { apply, blockName, gatesOnly } = parseOptions(process.argv.slice(2));
    const gateNames = new Set([
        'FenceGate',
        'WhiteFenceGate',
        'StoneFenceGate',
        'PolishedStoneFenceGate',
    ]);
    const selectedBlockSpecs = blockName
        ? blockSpecs.filter((spec) => spec.name === blockName)
        : blockSpecs.filter((spec) =>
              gatesOnly ? gateNames.has(spec.name) : !gateNames.has(spec.name),
          );
    if (selectedBlockSpecs.length === 0) {
        throw new Error(`Unknown fence block: ${blockName}`);
    }

    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const requiredPaths = new Set(
        selectedBlockSpecs.flatMap((spec) => Object.keys(spec.attributes)),
    );
    const missingDefinitions = Array.from(requiredPaths).filter(
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

    const summaries: Array<{
        name: string;
        entityId: number | null;
        action: 'create' | 'update' | 'unchanged';
        changedAttributes: string[];
        publish: boolean;
    }> = [];

    for (const spec of selectedBlockSpecs) {
        let entity = await findBlockEntity(nameDefinition.id, spec.name);
        let entityId = entity?.id ?? null;
        const changedAttributes: string[] = [];

        if (entityId) {
            for (const [path, expectedValue] of Object.entries(
                spec.attributes,
            )) {
                const definition = definitionsByPath.get(path);
                if (!definition) {
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
        } else {
            changedAttributes.push(...Object.keys(spec.attributes));
        }

        const publish =
            entity?.state !== 'published' || entity?.publishedAt === null;
        const action: 'create' | 'update' | 'unchanged' = !entity
            ? 'create'
            : changedAttributes.length > 0 || publish
              ? 'update'
              : 'unchanged';
        const summary = {
            name: spec.name,
            entityId,
            action,
            changedAttributes,
            publish,
        };
        summaries.push(summary);

        if (!apply) {
            continue;
        }

        if (!entityId) {
            entityId = await createEntity(entityTypeName, actor);
            summary.entityId = entityId;
        }

        for (const [path, expectedValue] of orderedAttributeEntries(
            spec.attributes,
        )) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                throw new Error(`Missing ${path} while applying ${spec.name}.`);
            }
            const existingValue = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId,
            });
            if (existingValue?.value === expectedValue) {
                continue;
            }
            await upsertAttributeValue(
                {
                    id: existingValue?.id,
                    attributeDefinitionId: definition.id,
                    entityId,
                    entityTypeName,
                    order: definition.order,
                    value: expectedValue,
                },
                actor,
            );
        }

        if (publish) {
            await updateEntity({ id: entityId, state: 'published' }, actor);
        }

        entity = await findBlockEntity(nameDefinition.id, spec.name);
        if (
            !entity ||
            entity.id !== entityId ||
            entity.state !== 'published' ||
            entity.publishedAt === null
        ) {
            throw new Error(`Failed to publish ${spec.name} block entity.`);
        }

        for (const [path, expectedValue] of Object.entries(spec.attributes)) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                throw new Error(
                    `Missing ${path} while verifying ${spec.name}.`,
                );
            }
            const storedValue = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId,
            });
            if (storedValue?.value !== expectedValue) {
                throw new Error(
                    `Unexpected ${path} for ${spec.name}: ${storedValue?.value ?? 'missing'}`,
                );
            }
        }
    }

    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                blocks: summaries,
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
