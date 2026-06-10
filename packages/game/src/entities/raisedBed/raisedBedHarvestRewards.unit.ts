import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
    AppliedOperationVisualInput,
    OperationVisualDefinitionInput,
    OperationVisualRewardKind,
} from '../../operationVisualRewards';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import { resolveRaisedBedHarvestPositions } from './raisedBedHarvestRewards';

function operation(
    id: number,
    input: {
        application?: string;
        label: string;
        name: string;
        visualReward: OperationVisualRewardKind;
    },
): OperationVisualDefinitionInput {
    return {
        id,
        attributes: {
            application: input.application ?? 'raisedBedFull',
            stage: {
                information: {
                    label: 'harvest',
                    name: 'harvest',
                },
            },
            visualReward: input.visualReward,
        },
        information: {
            description: input.label,
            instructions: '',
            label: input.label,
            name: input.name,
            shortDescription: input.label,
        },
        slug: input.name,
    };
}

const operations = [
    operation(1, {
        label: 'Berba gredice',
        name: 'raisedBedHarvest',
        visualReward: 'harvest',
    }),
    operation(2, {
        application: 'plant',
        label: 'Berba biljke',
        name: 'plantHarvest',
        visualReward: 'harvest',
    }),
];

function applied(
    id: number,
    input: {
        completedAt: string;
        entityId: number;
        raisedBedFieldId?: number | null;
        raisedBedId: number;
    },
): AppliedOperationVisualInput {
    return {
        id,
        completedAt: input.completedAt,
        createdAt: input.completedAt,
        entityId: input.entityId,
        raisedBedFieldId: input.raisedBedFieldId,
        raisedBedId: input.raisedBedId,
        status: 'completed',
    };
}

test('raised-bed harvest reward marks planted fields in the current block', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(101, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedHarvestPositions({
            blockOffset: 9,
            fields: [
                { active: true, id: 50, plantSortId: 337, positionIndex: 9 },
                { active: true, id: 51, plantSortId: null, positionIndex: 10 },
                {
                    active: false,
                    id: 52,
                    plantSortId: 337,
                    positionIndex: 11,
                },
                { active: true, id: 53, plantSortId: 337, positionIndex: 18 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [0],
    );
});

test('field harvest reward marks only the matching planted field', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(201, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 2,
                raisedBedFieldId: 51,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedHarvestPositions({
            blockOffset: 9,
            fields: [
                { active: true, id: 50, plantSortId: 337, positionIndex: 9 },
                { active: true, id: 51, plantSortId: 337, positionIndex: 10 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [1],
    );
});

test('harvest rewards ignore other raised beds', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(301, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 11,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedHarvestPositions({
            blockOffset: 0,
            fields: [
                { active: true, id: 50, plantSortId: 337, positionIndex: 0 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
});
