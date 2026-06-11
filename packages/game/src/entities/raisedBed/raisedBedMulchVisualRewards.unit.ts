import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
    AppliedOperationVisualInput,
    OperationVisualDefinitionInput,
    OperationVisualRewardKind,
} from '../../operationVisualRewards';
import {
    resolveActiveFieldMulchRewardsByFieldId,
    resolveActiveRaisedBedMulchReward,
    resolveMulchVisualByOperationId,
} from './raisedBedMulchVisualRewards';

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
        label: 'Malciranje slamom',
        name: 'mulchStraw',
        visualReward: 'mulch',
    }),
    operation(2, {
        label: 'Uklanjanje malca',
        name: 'removeMulch',
        visualReward: 'removeMulch',
    }),
    operation(3, {
        application: 'plant',
        label: 'Malciranje biljke',
        name: 'plantMulch',
        visualReward: 'mulch',
    }),
    operation(4, {
        application: 'plant',
        label: 'Uklanjanje malca s biljke',
        name: 'removePlantMulch',
        visualReward: 'removeMulch',
    }),
];

const mulchBlocks = [
    {
        id: 20,
        information: {
            name: 'MulchWood',
        },
    },
    {
        id: 21,
        information: {
            name: 'MulchHey',
        },
    },
    {
        id: 22,
        information: {
            name: 'MulchCoconut',
        },
    },
];

function applied(
    id: number,
    input: {
        completedAt: string;
        entityId: number;
        raisedBedFieldId?: number | null;
        raisedBedId?: number | null;
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

test('newer remove-mulch reward clears whole-bed mulch', () => {
    const reward = resolveActiveRaisedBedMulchReward({
        raisedBedId: 10,
        operations,
        appliedOperations: [
            applied(101, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
            applied(102, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 2,
                raisedBedId: 10,
            }),
        ],
    });

    assert.equal(reward, null);
});

test('older remove-mulch reward does not clear newer whole-bed mulch', () => {
    const reward = resolveActiveRaisedBedMulchReward({
        raisedBedId: 10,
        operations,
        appliedOperations: [
            applied(201, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 2,
                raisedBedId: 10,
            }),
            applied(202, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
        ],
    });

    assert.equal(reward?.entityId, 1);
});

test('nested whole-bed mulch operation inherits the current raised bed', () => {
    const reward = resolveActiveRaisedBedMulchReward({
        raisedBedId: 10,
        operations,
        appliedOperations: [
            applied(251, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 1,
            }),
        ],
    });

    assert.equal(reward?.raisedBedId, 10);
    assert.equal(reward?.entityId, 1);
});

test('field remove-mulch reward clears only the matching field', () => {
    const rewardsByFieldId = resolveActiveFieldMulchRewardsByFieldId({
        raisedBedId: 10,
        operations,
        appliedOperations: [
            applied(301, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 3,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
            applied(302, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 3,
                raisedBedFieldId: 51,
                raisedBedId: 10,
            }),
            applied(303, {
                completedAt: '2026-06-02T08:00:00.000Z',
                entityId: 4,
                raisedBedFieldId: 50,
                raisedBedId: 10,
            }),
        ],
    });

    assert.equal(rewardsByFieldId.has(50), false);
    assert.equal(rewardsByFieldId.get(51)?.entityId, 3);
});

test('generic mulch operation resolves to straw mulch visual', () => {
    const visuals = resolveMulchVisualByOperationId(
        [
            operation(20, {
                label: 'Debug mulch reward',
                name: 'debugMulchReward',
                visualReward: 'mulch',
            }),
        ],
        mulchBlocks,
    );

    assert.equal(visuals.get(20)?.blockName, 'MulchHey');
});

test('remove-mulch operation does not resolve to a visible mulch visual', () => {
    const visuals = resolveMulchVisualByOperationId(
        [
            operation(21, {
                label: 'Uklanjanje malča slamom',
                name: 'removeMalchStrawRaisedBed',
                visualReward: 'removeMulch',
            }),
        ],
        mulchBlocks,
    );

    assert.equal(visuals.has(21), false);
});
