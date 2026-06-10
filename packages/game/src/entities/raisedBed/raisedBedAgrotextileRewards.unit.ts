import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
    AppliedOperationVisualInput,
    OperationVisualDefinitionInput,
    OperationVisualRewardKind,
} from '../../operationVisualRewards';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import { resolveRaisedBedAgrotextileCoverPositions } from './raisedBedAgrotextileRewards';

function operation(
    id: number,
    input: {
        label: string;
        name: string;
        visualReward: OperationVisualRewardKind;
    },
): OperationVisualDefinitionInput {
    return {
        id,
        attributes: {
            application: 'raisedBedFull',
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
        label: 'Postavljanje agrotekstila',
        name: 'agrotextileCover',
        visualReward: 'agrotextile',
    }),
    operation(2, {
        label: 'Uklanjanje agrotekstila',
        name: 'removeAgrotextileCover',
        visualReward: 'removeAgrotextile',
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

test('whole-bed agrotextile cover marks every local field position', () => {
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
        resolveRaisedBedAgrotextileCoverPositions({
            blockOffset: 9,
            fields: [],
            raisedBedId: 10,
            visualRewards,
        }),
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
    );
});

test('field agrotextile cover marks only the matching active field in the current block', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(201, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedAgrotextileCoverPositions({
            blockOffset: 9,
            fields: [
                { active: true, id: 50, positionIndex: 10 },
                { active: true, id: 51, positionIndex: 4 },
                { active: false, id: 52, positionIndex: 11 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [1],
    );
});

test('newer remove-agrotextile reward clears field cover visuals', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(301, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
            applied(302, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 2,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedAgrotextileCoverPositions({
            blockOffset: 9,
            fields: [{ active: true, id: 50, positionIndex: 10 }],
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
});

test('newer remove-agrotextile reward clears whole-bed cover visuals', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(401, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
            applied(402, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 2,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedAgrotextileCoverPositions({
            blockOffset: 0,
            fields: [{ active: true, id: 50, positionIndex: 1 }],
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
});

test('field remove-agrotextile preserves covers on other fields', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(501, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
            applied(502, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedFieldId: 51,
                raisedBedId: 10,
            }),
            applied(503, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 2,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedAgrotextileCoverPositions({
            blockOffset: 9,
            fields: [
                { active: true, id: 50, positionIndex: 10 },
                { active: true, id: 51, positionIndex: 11 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [2],
    );
});

test('older remove-agrotextile reward does not clear newer cover visuals', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(601, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 2,
                raisedBedId: 10,
            }),
            applied(602, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedAgrotextileCoverPositions({
            blockOffset: 0,
            fields: [],
            raisedBedId: 10,
            visualRewards,
        }),
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
    );
});
