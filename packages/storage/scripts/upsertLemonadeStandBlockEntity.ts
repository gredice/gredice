import { and, eq } from 'drizzle-orm';
import {
    attributeDefinitions,
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

const blockName = 'LemonadeStand';
const entityTypeName = 'block';

const spanDefinitionSpecs = [
    {
        category: 'attributes',
        name: 'spanWidth',
        label: 'Širina zauzeća',
        description: 'Broj vrtnih blokova koje zauzima po širini.',
        defaultValue: '1',
    },
    {
        category: 'attributes',
        name: 'spanDepth',
        label: 'Dubina zauzeća',
        description: 'Broj vrtnih blokova koje zauzima po dubini.',
        defaultValue: '1',
    },
] satisfies Pick<
    SelectAttributeDefinition,
    'category' | 'name' | 'label' | 'description' | 'defaultValue'
>[];

const lemonadeStandAttributes = {
    'attributes.height': '1.9',
    'attributes.hitboxDepth': '1.25',
    'attributes.hitboxHeight': '1.9',
    'attributes.hitboxWidth': '2.4',
    'attributes.spanDepth': '2',
    'attributes.spanWidth': '3',
    'attributes.stackable': 'false',
    'attributes.type': 'decoration',
    'functions.raisedBed': 'false',
    'functions.recycler': 'false',
    'information.fullDescription':
        'Mali ljetni štand s limunadom unosi razigran, tržnički ugođaj u vrt i lijepo popunjava sezonske kutke za druženje.',
    'information.label': 'Štand s limunadom',
    'information.name': blockName,
    'information.shortDescription':
        'Mali ljetni štand s limunadom za uređenje vrta i sezonskih kutaka.',
    'prices.sunflowers': '140',
} satisfies Record<string, string>;

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

async function upsertSpanDefinition(
    spec: (typeof spanDefinitionSpecs)[number],
) {
    const [existingDefinition] = await storage()
        .select()
        .from(attributeDefinitions)
        .where(
            and(
                eq(attributeDefinitions.entityTypeName, entityTypeName),
                eq(attributeDefinitions.category, spec.category),
                eq(attributeDefinitions.name, spec.name),
                eq(attributeDefinitions.isDeleted, false),
            ),
        );

    const values = {
        ...spec,
        entityTypeName,
        dataType: 'number',
        required: false,
        display: false,
    };

    if (!existingDefinition) {
        await storage().insert(attributeDefinitions).values(values);
        return;
    }

    await storage()
        .update(attributeDefinitions)
        .set(values)
        .where(eq(attributeDefinitions.id, existingDefinition.id));
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

async function getExistingAttributeValueId({
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
    for (const spec of spanDefinitionSpecs) {
        await upsertSpanDefinition(spec);
    }

    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );

    const missingDefinitions = Object.keys(lemonadeStandAttributes).filter(
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
    for (const [path, value] of Object.entries(lemonadeStandAttributes)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            continue;
        }

        const existingValue = await getExistingAttributeValueId({
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

    console.log(
        `${created ? 'Created' : 'Updated'} ${blockName} block entity ${entityId}. Upserted ${changedValueCount} attributes.`,
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
