import { and, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    createAttributeDefinition,
    entities,
    getAttributeDefinitions,
    type SelectAttributeDefinition,
    storage,
    updateAttributeDefinition,
    upsertAttributeValue,
} from '../src';

type OperationVisualRewardKind =
    | 'agrotextile'
    | 'harvest'
    | 'mulch'
    | 'removeAgrotextile'
    | 'removeMulch'
    | 'supports'
    | 'watering'
    | 'weeding';

const actor = {
    id: 'codex',
    name: 'Codex',
};

const entityTypeName = 'operation';
const visualRewardAttribute = {
    category: 'attributes',
    dataType: 'text',
    description:
        'Controls the exact in-game visual reward a completed operation creates. Supported values: watering, weeding, mulch, removeMulch, agrotextile, removeAgrotextile, supports, harvest.',
    display: false,
    entityTypeName,
    label: 'Vizualna nagrada',
    multiple: false,
    name: 'visualReward',
    order: '136',
    required: false,
};

const operationVisualRewardAssignments = [
    { operationName: 'harvest25Mature', visualReward: 'harvest' },
    { operationName: 'harvest50Mature', visualReward: 'harvest' },
    { operationName: 'harvestPlant', visualReward: 'harvest' },
    { operationName: 'harvestAll', visualReward: 'harvest' },
    { operationName: 'harvestMature', visualReward: 'harvest' },
    { operationName: 'malchStrawPlant', visualReward: 'mulch' },
    { operationName: 'malchStrawRaisedBed', visualReward: 'mulch' },
    { operationName: 'setAgrotextileWhite', visualReward: 'agrotextile' },
    { operationName: 'plantingPlantSupport', visualReward: 'supports' },
    { operationName: 'growthPlantSupport', visualReward: 'supports' },
    { operationName: 'watterSurfaceRaisedBed', visualReward: 'watering' },
    { operationName: 'watteringSystemSprinkler2', visualReward: 'watering' },
    {
        operationName: 'removeAgrotextileWhite',
        visualReward: 'removeAgrotextile',
    },
    { operationName: 'pullingWeedsRaisedBed', visualReward: 'weeding' },
    { operationName: 'pullingWeedsPlant', visualReward: 'weeding' },
    { operationName: 'removeMalchStrawPlant', visualReward: 'removeMulch' },
    { operationName: 'removeMalchStrawRaisedBed', visualReward: 'removeMulch' },
    { operationName: 'supportTying', visualReward: 'supports' },
    { operationName: 'watterRaisedBed', visualReward: 'watering' },
] satisfies {
    operationName: string;
    visualReward: OperationVisualRewardKind;
}[];

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

async function getOperationDefinitionsByPath() {
    const definitions = await getAttributeDefinitions(entityTypeName);

    return new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
}

async function ensureVisualRewardAttributeDefinition() {
    const definitionsByPath = await getOperationDefinitionsByPath();
    const existingDefinition = definitionsByPath.get('attributes.visualReward');

    if (!existingDefinition) {
        const id = await createAttributeDefinition(visualRewardAttribute);
        const refreshedDefinitionsByPath =
            await getOperationDefinitionsByPath();
        const createdDefinition = refreshedDefinitionsByPath.get(
            'attributes.visualReward',
        );
        if (!createdDefinition || createdDefinition.id !== id) {
            throw new Error('Failed to create attributes.visualReward.');
        }

        return createdDefinition;
    }

    const shouldUpdate =
        existingDefinition.dataType !== visualRewardAttribute.dataType ||
        existingDefinition.description !== visualRewardAttribute.description ||
        existingDefinition.display !== visualRewardAttribute.display ||
        existingDefinition.label !== visualRewardAttribute.label ||
        existingDefinition.multiple !== visualRewardAttribute.multiple ||
        existingDefinition.order !== visualRewardAttribute.order ||
        existingDefinition.required !== visualRewardAttribute.required;

    if (shouldUpdate) {
        await updateAttributeDefinition({
            id: existingDefinition.id,
            ...visualRewardAttribute,
        });
        const refreshedDefinitionsByPath =
            await getOperationDefinitionsByPath();
        const updatedDefinition = refreshedDefinitionsByPath.get(
            'attributes.visualReward',
        );
        if (!updatedDefinition) {
            throw new Error('Failed to update attributes.visualReward.');
        }

        return updatedDefinition;
    }

    return existingDefinition;
}

async function findOperationEntityIdByName({
    name,
    nameDefinition,
}: {
    name: string;
    nameDefinition: SelectAttributeDefinition;
}) {
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
                eq(attributeValues.value, name),
            ),
        )
        .limit(2);

    if (matches.length !== 1) {
        throw new Error(
            `Expected exactly one operation named ${name}, found ${matches.length}.`,
        );
    }

    return matches[0].id;
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
    const definitionsByPath = await getOperationDefinitionsByPath();
    const nameDefinition = definitionsByPath.get('information.name');
    if (!nameDefinition) {
        throw new Error('Missing operation information.name definition.');
    }

    const visualRewardDefinition =
        await ensureVisualRewardAttributeDefinition();
    let changedValueCount = 0;

    for (const assignment of operationVisualRewardAssignments) {
        const entityId = await findOperationEntityIdByName({
            name: assignment.operationName,
            nameDefinition,
        });
        const existingValue = await getExistingAttributeValue({
            attributeDefinitionId: visualRewardDefinition.id,
            entityId,
        });

        if (existingValue?.value === assignment.visualReward) {
            continue;
        }

        await upsertAttributeValue(
            {
                id: existingValue?.id,
                attributeDefinitionId: visualRewardDefinition.id,
                entityId,
                entityTypeName,
                order: visualRewardDefinition.order,
                value: assignment.visualReward,
            },
            actor,
        );
        changedValueCount += 1;
    }

    console.log(
        `Upserted attributes.visualReward definition ${visualRewardDefinition.id}. Updated ${changedValueCount} operation visual reward values.`,
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
