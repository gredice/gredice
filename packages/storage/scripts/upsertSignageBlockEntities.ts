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

const actor = {
    id: 'codex',
    name: 'Codex',
};

const entityTypeName = 'block';

type ArrowSignSpec = {
    colorInstrumental: string;
    colorNominative: string;
    direction: string;
    height: string;
    label: string;
    name: string;
};

const arrowSignSpecs = [
    {
        name: 'ArrowSignWhiteLeft',
        label: 'Bijeli putokaz – lijevo',
        colorInstrumental: 'bijelom',
        colorNominative: 'Bijela',
        direction: 'lijevo',
        height: '1.18',
    },
    {
        name: 'ArrowSignRedLeft',
        label: 'Crveni putokaz – lijevo',
        colorInstrumental: 'crvenom',
        colorNominative: 'Crvena',
        direction: 'lijevo',
        height: '1.18',
    },
    {
        name: 'ArrowSignBlueLeft',
        label: 'Plavi putokaz – lijevo',
        colorInstrumental: 'plavom',
        colorNominative: 'Plava',
        direction: 'lijevo',
        height: '1.18',
    },
    {
        name: 'ArrowSignGreenLeft',
        label: 'Zeleni putokaz – lijevo',
        colorInstrumental: 'zelenom',
        colorNominative: 'Zelena',
        direction: 'lijevo',
        height: '1.18',
    },
    {
        name: 'ArrowSignWoodLeft',
        label: 'Drveni putokaz – lijevo',
        colorInstrumental: 'drvenom',
        colorNominative: 'Drvena',
        direction: 'lijevo',
        height: '1.18',
    },
    {
        name: 'ArrowSignWhiteRight',
        label: 'Bijeli putokaz – desno',
        colorInstrumental: 'bijelom',
        colorNominative: 'Bijela',
        direction: 'desno',
        height: '1.18',
    },
    {
        name: 'ArrowSignRedRight',
        label: 'Crveni putokaz – desno',
        colorInstrumental: 'crvenom',
        colorNominative: 'Crvena',
        direction: 'desno',
        height: '1.18',
    },
    {
        name: 'ArrowSignBlueRight',
        label: 'Plavi putokaz – desno',
        colorInstrumental: 'plavom',
        colorNominative: 'Plava',
        direction: 'desno',
        height: '1.18',
    },
    {
        name: 'ArrowSignGreenRight',
        label: 'Zeleni putokaz – desno',
        colorInstrumental: 'zelenom',
        colorNominative: 'Zelena',
        direction: 'desno',
        height: '1.18',
    },
    {
        name: 'ArrowSignWoodRight',
        label: 'Drveni putokaz – desno',
        colorInstrumental: 'drvenom',
        colorNominative: 'Drvena',
        direction: 'desno',
        height: '1.18',
    },
    {
        name: 'ArrowSignWhiteUp',
        label: 'Bijeli putokaz – gore',
        colorInstrumental: 'bijelom',
        colorNominative: 'Bijela',
        direction: 'gore',
        height: '1.32',
    },
    {
        name: 'ArrowSignRedUp',
        label: 'Crveni putokaz – gore',
        colorInstrumental: 'crvenom',
        colorNominative: 'Crvena',
        direction: 'gore',
        height: '1.32',
    },
    {
        name: 'ArrowSignBlueUp',
        label: 'Plavi putokaz – gore',
        colorInstrumental: 'plavom',
        colorNominative: 'Plava',
        direction: 'gore',
        height: '1.32',
    },
    {
        name: 'ArrowSignGreenUp',
        label: 'Zeleni putokaz – gore',
        colorInstrumental: 'zelenom',
        colorNominative: 'Zelena',
        direction: 'gore',
        height: '1.32',
    },
    {
        name: 'ArrowSignWoodUp',
        label: 'Drveni putokaz – gore',
        colorInstrumental: 'drvenom',
        colorNominative: 'Drvena',
        direction: 'gore',
        height: '1.32',
    },
    {
        name: 'ArrowSignWhiteDown',
        label: 'Bijeli putokaz – dolje',
        colorInstrumental: 'bijelom',
        colorNominative: 'Bijela',
        direction: 'dolje',
        height: '1.32',
    },
    {
        name: 'ArrowSignRedDown',
        label: 'Crveni putokaz – dolje',
        colorInstrumental: 'crvenom',
        colorNominative: 'Crvena',
        direction: 'dolje',
        height: '1.32',
    },
    {
        name: 'ArrowSignBlueDown',
        label: 'Plavi putokaz – dolje',
        colorInstrumental: 'plavom',
        colorNominative: 'Plava',
        direction: 'dolje',
        height: '1.32',
    },
    {
        name: 'ArrowSignGreenDown',
        label: 'Zeleni putokaz – dolje',
        colorInstrumental: 'zelenom',
        colorNominative: 'Zelena',
        direction: 'dolje',
        height: '1.32',
    },
    {
        name: 'ArrowSignWoodDown',
        label: 'Drveni putokaz – dolje',
        colorInstrumental: 'drvenom',
        colorNominative: 'Drvena',
        direction: 'dolje',
        height: '1.32',
    },
] satisfies ArrowSignSpec[];

function requirePositiveIntegerEnvironmentVariable(name: string) {
    const value = process.env[name]?.trim();
    if (!value || !/^[1-9]\d*$/u.test(value)) {
        throw new Error(`${name} must be a positive integer.`);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
        throw new Error(`${name} must be a safe positive integer.`);
    }

    return parsed.toString();
}

function commonBlockAttributes({
    fullDescription,
    height,
    hitboxDepth,
    hitboxWidth,
    label,
    name,
    price,
    shortDescription,
}: {
    fullDescription: string;
    height: string;
    hitboxDepth: string;
    hitboxWidth: string;
    label: string;
    name: string;
    price: string;
    shortDescription: string;
}) {
    return {
        'attributes.height': height,
        'attributes.hitboxDepth': hitboxDepth,
        'attributes.hitboxHeight': height,
        'attributes.hitboxWidth': hitboxWidth,
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
    } satisfies Record<string, string>;
}

function createSignageBlockAttributes({
    arrowPrice,
    woodenSignPrice,
}: {
    arrowPrice: string;
    woodenSignPrice: string;
}) {
    return [
        ...arrowSignSpecs.map((spec) => ({
            name: spec.name,
            attributes: commonBlockAttributes({
                name: spec.name,
                label: spec.label,
                height: spec.height,
                hitboxDepth: '0.12',
                hitboxWidth: '0.8',
                price: arrowPrice,
                shortDescription: `Drveni vrtni putokaz s ${spec.colorInstrumental} strelicom koja pokazuje ${spec.direction}.`,
                fullDescription: `Postavi ovaj drveni putokaz uz stazu, gredice ili ulaz u vrt kao jasan orijentir. ${spec.colorNominative} strelica pokazuje ${spec.direction}.`,
            }),
        })),
        {
            name: 'WoodenSign',
            attributes: commonBlockAttributes({
                name: 'WoodenSign',
                label: 'Drvena ploča za natpis',
                height: '1.16',
                hitboxDepth: '0.12',
                hitboxWidth: '0.88',
                price: woodenSignPrice,
                shortDescription:
                    'Drvena vrtna ploča na koju možeš upisati vlastiti natpis do 12 znakova po redu, u jednom ili dva reda.',
                fullDescription:
                    'Postavi drvenu ploču uz gredicu, stazu ili ulaz, zatim je odaberi i upiši natpis do 12 znakova po redu. Tekst može biti raspoređen u jednom ili dva reda i kasnije ga možeš ponovno urediti.',
            }),
        },
    ];
}

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

async function findBlockEntity(
    nameDefinition: SelectAttributeDefinition,
    blockName: string,
) {
    const [existingEntity] = await storage()
        .select({ id: entities.id, state: entities.state })
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

    return existingEntity ?? null;
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
    // Validate both prices before any repository helper can perform a write.
    const arrowPrice = requirePositiveIntegerEnvironmentVariable(
        'SIGNAGE_ARROW_SUNFLOWERS',
    );
    const woodenSignPrice = requirePositiveIntegerEnvironmentVariable(
        'SIGNAGE_WOODEN_SIGN_SUNFLOWERS',
    );
    const publish = process.env.SIGNAGE_PUBLISH === '1';
    const blockSpecs = createSignageBlockAttributes({
        arrowPrice,
        woodenSignPrice,
    });

    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const requiredPaths = new Set(
        blockSpecs.flatMap((spec) => Object.keys(spec.attributes)),
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

    let createdCount = 0;
    let publishedCount = 0;
    let changedValueCount = 0;

    for (const spec of blockSpecs) {
        let entity = await findBlockEntity(nameDefinition, spec.name);
        const created = entity === null;
        if (!entity) {
            entity = {
                id: await createEntity(entityTypeName, actor),
                state: 'draft',
            };
            createdCount += 1;
        }

        let entityChangedValueCount = 0;
        for (const [path, value] of Object.entries(spec.attributes)) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                continue;
            }

            const existingValue = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId: entity.id,
            });
            if (existingValue?.value === value) {
                continue;
            }

            await upsertAttributeValue(
                {
                    id: existingValue?.id,
                    attributeDefinitionId: definition.id,
                    entityId: entity.id,
                    entityTypeName,
                    order: definition.order,
                    value,
                },
                actor,
            );
            entityChangedValueCount += 1;
        }

        if (publish && entity.state !== 'published') {
            await updateEntity(
                {
                    id: entity.id,
                    state: 'published',
                },
                actor,
            );
            publishedCount += 1;
        }

        changedValueCount += entityChangedValueCount;
        console.log(
            `${created ? 'Created' : 'Updated'} ${spec.name} block entity ${entity.id}. Upserted ${entityChangedValueCount} attributes; ${publish ? 'publication requested' : 'state preserved'}.`,
        );
    }

    console.log(
        `Prepared ${blockSpecs.length} signage blocks: ${createdCount} created, ${changedValueCount} attribute values changed, ${publishedCount} published.`,
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
