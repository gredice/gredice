import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
    AppliedOperationVisualInput,
    OperationVisualDefinitionInput,
    OperationVisualRewardKind,
} from '../../operationVisualRewards';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import { resolveRaisedBedSupportPositions } from './raisedBedSupportRewards';

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
        label: 'Postavljanje potpore',
        name: 'plantSupports',
        visualReward: 'supports',
    }),
    operation(2, {
        application: 'plant',
        label: 'Vezanje biljke uz kolac',
        name: 'plantStakeTie',
        visualReward: 'supports',
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

test('raised-bed support reward marks planted fields in the current block', () => {
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
        resolveRaisedBedSupportPositions({
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

test('raised-bed support reward is removed from replacement plants', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(151, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedSupportPositions({
            blockOffset: 9,
            fields: [
                {
                    active: true,
                    id: 50,
                    plantCycles: [
                        {
                            active: true,
                            startedAt: '2026-05-01T08:00:00.000Z',
                        },
                    ],
                    plantSortId: 337,
                    positionIndex: 9,
                },
                {
                    active: true,
                    id: 51,
                    plantCycles: [
                        {
                            active: false,
                            startedAt: '2026-05-01T08:00:00.000Z',
                        },
                        {
                            active: true,
                            startedAt: '2026-06-02T08:00:00.000Z',
                        },
                    ],
                    plantSortId: 337,
                    positionIndex: 10,
                },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [0],
    );
});

test('field support reward marks only the matching planted field', () => {
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
        resolveRaisedBedSupportPositions({
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

test('field support reward is removed when the field changes plant', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(251, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 2,
                raisedBedFieldId: 51,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedSupportPositions({
            blockOffset: 9,
            fields: [
                {
                    active: true,
                    id: 51,
                    plantCycles: [
                        {
                            active: false,
                            startedAt: '2026-05-01T08:00:00.000Z',
                        },
                        {
                            active: true,
                            startedAt: '2026-06-02T08:00:00.000Z',
                        },
                    ],
                    plantSortId: 337,
                    positionIndex: 10,
                },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
});

test('field support reward stays visible during the active plant cycle', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(261, {
                completedAt: '2026-06-02T09:00:00.000Z',
                entityId: 2,
                raisedBedFieldId: 51,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedSupportPositions({
            blockOffset: 9,
            fields: [
                {
                    active: true,
                    id: 51,
                    plantCycles: [
                        {
                            active: true,
                            startedAt: '2026-06-02T08:00:00.000Z',
                        },
                    ],
                    plantSortId: 337,
                    positionIndex: 10,
                },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [1],
    );
});

test('support rewards ignore other raised beds', () => {
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
        resolveRaisedBedSupportPositions({
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
