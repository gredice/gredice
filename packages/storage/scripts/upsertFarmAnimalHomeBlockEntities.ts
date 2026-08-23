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
// dry-run prevents animal catalogue entries from pointing at assets that are
// not live. Rabbit is a directly placeable animal; the other entries are homes.

const actor = {
    id: 'codex',
    name: 'Codex',
};

const entityTypeName = 'block';

function animalBlockSpec({
    fullDescription,
    height,
    hitboxDepth,
    hitboxWidth,
    label,
    name,
    shortDescription,
    sunflowers = 500,
}: {
    fullDescription: string;
    height: number;
    hitboxDepth: number;
    hitboxWidth: number;
    label: string;
    name: string;
    shortDescription: string;
    sunflowers?: number;
}) {
    const heightValue = height.toString();

    return {
        name,
        attributes: {
            'attributes.height': heightValue,
            'attributes.hitboxDepth': hitboxDepth.toString(),
            'attributes.hitboxHeight': heightValue,
            'attributes.hitboxWidth': hitboxWidth.toString(),
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
            'prices.sunflowers': sunflowers.toString(),
        },
    };
}

const blockSpecs = [
    animalBlockSpec({
        name: 'ChickenCoop',
        label: 'Kokošinjac',
        shortDescription:
            'Topao drveni kokošinjac koji u vrt dovodi znatiželjnu kokoš.',
        fullDescription:
            'Smjesti drveni kokošinjac uz gredice i u vrt će stići znatiželjna kokoš. Danju će kljucati i istraživati okolicu, a pred noć se vraćati svojem sigurnom skloništu.',
        height: 0.86,
        hitboxDepth: 0.97,
        hitboxWidth: 0.76,
    }),
    animalBlockSpec({
        name: 'PigletPen',
        label: 'Obor za praščića',
        shortDescription:
            'Mali obor s kaljužom koji u vrt dovodi razigranog praščića.',
        fullDescription:
            'Postavi niski obor od pruća s koritom i kaljužom pa će u vrt stići razigrani praščić. Njuškat će po zemlji, valjati se u blatu i vraćati se u svoj zaklon.',
        height: 0.78,
        hitboxDepth: 0.89,
        hitboxWidth: 0.94,
    }),
    animalBlockSpec({
        name: 'Rabbit',
        label: 'Zec',
        shortDescription:
            'Znatiželjni zec koji skakuće vrtom, njuška i kratko pase.',
        fullDescription:
            'Postavi zeca izravno u vrt. Skakutat će po sigurnom tlu, zastajati kako bi njuškao, uređivao krzno i kratko grickao travu, a pred avatarom će brzo pobjeći obilazeći prepreke.',
        height: 0.456,
        hitboxDepth: 0.432,
        hitboxWidth: 0.348,
        sunflowers: 350,
    }),
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
        : blockSpecs.filter((spec) => spec.name !== 'Rabbit');
    if (selectedBlockSpecs.length === 0) {
        throw new Error(`Unknown animal catalogue block: ${blockName}`);
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
