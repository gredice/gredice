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

// Deploy the runtime and public assets before using --apply. The default
// dry-run prevents catalog entries from pointing at models and covers that are
// not live yet. Use `--name DoubleGardenLightPole` to inspect or apply only
// this exact block without touching the rest of the lighting catalogue.

const actor = {
    id: 'codex',
    name: 'Codex',
};

const entityTypeName = 'block';

const blockSpecs = [
    {
        name: 'StoneWalkway',
        attributes: {
            'attributes.height': '0.1',
            'attributes.hitboxDepth': '1',
            'attributes.hitboxHeight': '0.1',
            'attributes.hitboxWidth': '0.86',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'true',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                'https://www.gredice.com/assets/blocks/StoneWalkway.webp',
            ),
            'information.fullDescription':
                'Kamena staza od nepravilnih vapnenačkih ploča koje se slažu jedna uz drugu. Položi je preko trave, zemlje ili vode i poveži više komada u čvrst vrtni puteljak.',
            'information.label': 'Kamena staza',
            'information.name': 'StoneWalkway',
            'information.shortDescription':
                'Niske vapnenačke ploče za stazu preko tla ili uskog vodenog kanala.',
            'prices.sunflowers': '50',
        },
    },
    {
        name: 'EnamelGardenLamp',
        attributes: {
            'attributes.height': '1.45',
            'attributes.hitboxDepth': '0.46',
            'attributes.hitboxHeight': '1.45',
            'attributes.hitboxWidth': '0.52',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                'https://www.gredice.com/assets/blocks/EnamelGardenLamp.webp',
            ),
            'information.fullDescription':
                'Vrtna lampa na drvenom stupu s plavim emajliranim sjenilom. Postavi je uz stazu, gredicu ili mjesto za odmor kako bi vrt dobio postojan krug toplog svjetla.',
            'information.label': 'Emajlirana vrtna lampa',
            'information.name': 'EnamelGardenLamp',
            'information.shortDescription':
                'Visoka vrtna lampa s emajliranim sjenilom i toplim, mirnim svjetlom.',
            'prices.sunflowers': '80',
        },
    },
    {
        name: 'DoubleGardenLightPole',
        attributes: {
            'attributes.height': '2.2',
            'attributes.hitboxDepth': '0.38',
            'attributes.hitboxHeight': '2.2',
            'attributes.hitboxWidth': '0.94',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                'https://www.gredice.com/assets/blocks/DoubleGardenLightPole.webp',
            ),
            'information.fullDescription':
                'Vitki drveni rasvjetni stup s dvije nasuprotne svjetiljke usmjerene prema tlu. Postavi ga između stolova ili uz stazu kako bi noću osvijetlio prolaz i obližnje biljke.',
            'information.label': 'Dvostruki drveni rasvjetni stup',
            'information.name': 'DoubleGardenLightPole',
            'information.shortDescription':
                'Visoki drveni stup s dvije nasuprotne svjetiljke za osvjetljenje staza i biljaka.',
            'prices.sunflowers': '120',
        },
    },
    {
        name: 'HazelLightArch',
        attributes: {
            'attributes.height': '1.65',
            'attributes.hitboxDepth': '1',
            'attributes.hitboxHeight': '1.65',
            'attributes.hitboxWidth': '0.24',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                'https://www.gredice.com/assets/blocks/HazelLightArch.webp',
            ),
            'information.fullDescription':
                'Savijene lijeskove grane nose niz toplih lampica ispod malih sjenila od terakote. Luk označava ulaz, prolaz ili mjesto za sjedenje i obasjava prostor odozgo.',
            'information.label': 'Svjetleći luk od lijeske',
            'information.name': 'HazelLightArch',
            'information.shortDescription':
                'Luk od lijeskovih grana s visećim lampicama za osvjetljenje vrtnog prolaza.',
            'prices.sunflowers': '120',
        },
    },
    {
        name: 'RoofTileLantern',
        attributes: {
            'attributes.height': '0.4',
            'attributes.hitboxDepth': '0.48',
            'attributes.hitboxHeight': '0.4',
            'attributes.hitboxWidth': '0.48',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                'https://www.gredice.com/assets/blocks/RoofTileLantern.webp',
            ),
            'information.fullDescription':
                'Fenjer složen od starih crvenih crjepova skriva toplo svjetlo u kamenoj jezgri. Postavi ga uz rub staze ili gredice kao nizak svjetleći orijentir.',
            'information.label': 'Fenjer od starog crijepa',
            'information.name': 'RoofTileLantern',
            'information.shortDescription':
                'Niski fenjer od starog crijepa koji stazu obasjava toplim svjetlom.',
            'prices.sunflowers': '40',
        },
    },
    {
        name: 'WickerGardenLantern',
        attributes: {
            'attributes.height': '0.7',
            'attributes.hitboxDepth': '0.62',
            'attributes.hitboxHeight': '0.7',
            'attributes.hitboxWidth': '0.62',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                'https://www.gredice.com/assets/blocks/WickerGardenLantern.webp',
            ),
            'information.fullDescription':
                'Ručno pleteni fenjer na podlozi od terakote i kamena. Široki otvori u pruću propuštaju meko jantarno svjetlo i stvaraju ugodan vrtni kutak.',
            'information.label': 'Pleteni vrtni fenjer',
            'information.name': 'WickerGardenLantern',
            'information.shortDescription':
                'Zaobljeni fenjer od pruća koji kroz pletivo širi meko jantarno svjetlo.',
            'prices.sunflowers': '60',
        },
    },
    {
        name: 'WoodenHandLantern',
        attributes: {
            'attributes.height': '0.66',
            'attributes.hitboxDepth': '0.4',
            'attributes.hitboxHeight': '0.66',
            'attributes.hitboxWidth': '0.44',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                'https://www.gredice.com/assets/blocks/WoodenHandLantern.webp',
            ),
            'information.fullDescription':
                'Kompaktan drveni fenjer s ručkom i zaštićenom svjetiljkom. Smjesti ga uz klupu, stazu ili ulaz kao mali dekorativni izvor toplog svjetla.',
            'information.label': 'Drveni ručni fenjer',
            'information.name': 'WoodenHandLantern',
            'information.shortDescription':
                'Mali drveni ručni fenjer s toplim svjetlom za vrtne kutke.',
            'prices.sunflowers': '50',
        },
    },
    {
        name: 'MoonRainBarrel',
        attributes: {
            'attributes.height': '1',
            'attributes.hitboxDepth': '0.84',
            'attributes.hitboxHeight': '1',
            'attributes.hitboxWidth': '0.76',
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                'https://www.gredice.com/assets/blocks/MoonRainBarrel.webp',
            ),
            'information.fullDescription':
                'Drvena bačva s pocinčanim obručima, nagnutim poklopcem i plutajućim listom. Blagi plavi odsjaj i spori krugovi na vodi stvaraju hladan mjesečev naglasak u vrtu.',
            'information.label': 'Mjesečeva bačva',
            'information.name': 'MoonRainBarrel',
            'information.shortDescription':
                'Ukrasna drvena bačva s plavom vodom koja noću svijetli poput mjesečine.',
            'prices.sunflowers': '100',
        },
    },
] satisfies Array<{
    name: string;
    attributes: Record<string, string>;
}>;

function parseOptions(argv: string[]) {
    let apply = false;
    let blockName: string | null = null;
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--') {
            continue;
        }
        if (argument === '--apply') {
            apply = true;
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
    return { apply, blockName };
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
    const { apply, blockName } = parseOptions(process.argv.slice(2));
    const selectedBlockSpecs = blockName
        ? blockSpecs.filter((spec) => spec.name === blockName)
        : blockSpecs;
    if (selectedBlockSpecs.length === 0) {
        throw new Error(`Unknown garden lighting block: ${blockName}`);
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
