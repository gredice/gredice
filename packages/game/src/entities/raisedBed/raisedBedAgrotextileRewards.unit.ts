import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
    AppliedOperationVisualInput,
    OperationVisualDefinitionInput,
    OperationVisualRewardKind,
} from '../../operationVisualRewards';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import {
    hasActiveRaisedBedInsectMesh,
    hasActiveRaisedBedProtectiveCover,
    resolveRaisedBedInsectMeshPositions,
    resolveRaisedBedProtectiveCoverPositions,
} from './raisedBedAgrotextileRewards';

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
    operation(3, {
        label: 'Postavljanje zaštitne mreže protiv kukaca',
        name: 'installInsectProtectionMesh',
        visualReward: 'insectMesh',
    }),
    operation(4, {
        label: 'Uklanjanje zaštitne mreže protiv kukaca',
        name: 'removeInsectProtectionMesh',
        visualReward: 'removeInsectMesh',
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
        resolveRaisedBedProtectiveCoverPositions({
            blockOffset: 9,
            fields: [],
            raisedBedId: 10,
            visualRewards,
        }),
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.equal(
        hasActiveRaisedBedProtectiveCover({
            raisedBedId: 10,
            visualRewards,
        }),
        true,
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
        resolveRaisedBedProtectiveCoverPositions({
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
        resolveRaisedBedProtectiveCoverPositions({
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
        resolveRaisedBedProtectiveCoverPositions({
            blockOffset: 0,
            fields: [{ active: true, id: 50, positionIndex: 1 }],
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
    assert.equal(
        hasActiveRaisedBedProtectiveCover({
            raisedBedId: 10,
            visualRewards,
        }),
        false,
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
        resolveRaisedBedProtectiveCoverPositions({
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
        resolveRaisedBedProtectiveCoverPositions({
            blockOffset: 0,
            fields: [],
            raisedBedId: 10,
            visualRewards,
        }),
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
    );
});

test('whole-bed insect mesh is resolved separately from opaque agrotextile', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(701, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 3,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedProtectiveCoverPositions({
            blockOffset: 0,
            fields: [],
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
    assert.deepStrictEqual(
        resolveRaisedBedInsectMeshPositions({
            blockOffset: 0,
            fields: [],
            raisedBedId: 10,
            visualRewards,
        }),
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.equal(
        hasActiveRaisedBedProtectiveCover({
            raisedBedId: 10,
            visualRewards,
        }),
        false,
    );
    assert.equal(
        hasActiveRaisedBedInsectMesh({
            raisedBedId: 10,
            visualRewards,
        }),
        true,
    );
});

test('coexisting agrotextile and insect mesh keep independent field visuals', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(801, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
            applied(802, {
                completedAt: '2026-06-01T09:00:00.000Z',
                entityId: 3,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedProtectiveCoverPositions({
            blockOffset: 9,
            fields: [{ active: true, id: 50, positionIndex: 10 }],
            raisedBedId: 10,
            visualRewards,
        }),
        [1],
    );
    assert.deepStrictEqual(
        resolveRaisedBedInsectMeshPositions({
            blockOffset: 9,
            fields: [{ active: true, id: 50, positionIndex: 10 }],
            raisedBedId: 10,
            visualRewards,
        }),
        [1],
    );
});

test('removing insect mesh preserves an active agrotextile cover', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(901, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
            applied(902, {
                completedAt: '2026-06-01T09:00:00.000Z',
                entityId: 3,
                raisedBedId: 10,
            }),
            applied(903, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 4,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.equal(
        hasActiveRaisedBedProtectiveCover({
            raisedBedId: 10,
            visualRewards,
        }),
        true,
    );
    assert.equal(
        hasActiveRaisedBedInsectMesh({
            raisedBedId: 10,
            visualRewards,
        }),
        false,
    );
});

test('removing agrotextile preserves an active insect mesh cover', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(1001, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
            applied(1002, {
                completedAt: '2026-06-01T09:00:00.000Z',
                entityId: 3,
                raisedBedId: 10,
            }),
            applied(1003, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 2,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.equal(
        hasActiveRaisedBedProtectiveCover({
            raisedBedId: 10,
            visualRewards,
        }),
        false,
    );
    assert.equal(
        hasActiveRaisedBedInsectMesh({
            raisedBedId: 10,
            visualRewards,
        }),
        true,
    );
});
