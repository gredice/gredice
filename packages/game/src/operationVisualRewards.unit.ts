import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    operationVisualRewardDebugOperationDefinitions,
    operationVisualRewardDebugScenarios,
} from './operationVisualRewardDebugProfile';
import {
    type AppliedOperationVisualInput,
    filterOperationVisualRewards,
    type OperationHistoryVisualInput,
    type OperationVisualDefinitionInput,
    type OperationVisualRewardKind,
    resolveOperationVisualRewardKind,
    resolveOperationVisualRewards,
} from './operationVisualRewards';

function operation(
    id: number,
    input: {
        application?: string;
        label: string;
        name: string;
        stage?: string;
        visualReward?: OperationVisualRewardKind | string | null;
    },
): OperationVisualDefinitionInput {
    return {
        id,
        attributes: {
            application: input.application ?? 'raisedBedFull',
            stage: {
                information: {
                    name: input.stage ?? 'maintenance',
                    label: input.stage ?? 'maintenance',
                },
            },
            ...(input.visualReward !== undefined
                ? { visualReward: input.visualReward }
                : {}),
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
        label: 'Zalijevanje gredice',
        name: 'wateringRaisedBed',
        stage: 'watering',
        visualReward: 'watering',
    }),
    operation(2, {
        label: 'Malčiranje slamom',
        name: 'mulchStraw',
        visualReward: 'mulch',
    }),
    operation(3, {
        label: 'Uklanjanje malča',
        name: 'removeMulch',
        visualReward: 'removeMulch',
    }),
    operation(4, {
        label: 'Postavljanje agrotekstila',
        name: 'agrotextileCover',
        visualReward: 'agrotextile',
    }),
    operation(5, {
        label: 'Uklanjanje agrotekstila',
        name: 'removeAgrotextileCover',
        visualReward: 'removeAgrotextile',
    }),
    operation(6, {
        application: 'plant',
        label: 'Plijevljenje korova',
        name: 'weeding',
        visualReward: 'weeding',
    }),
    operation(7, {
        application: 'plant',
        label: 'Postavljanje potpore',
        name: 'plantSupports',
        visualReward: 'supports',
    }),
    operation(8, {
        application: 'plant',
        label: 'Berba plodova',
        name: 'harvestPlant',
        stage: 'harvest',
        visualReward: 'harvest',
    }),
    operation(9, {
        label: 'Fotografiranje gredice',
        name: 'raisedBedPhotography',
        visualReward: 'photographyUpdate',
    }),
];

function applied(
    id: number,
    input: {
        completedAt: string;
        entityId: number;
        raisedBedFieldId?: number | null;
        raisedBedId?: number | null;
        status?: string;
    },
): AppliedOperationVisualInput {
    return {
        id,
        completedAt: input.completedAt,
        createdAt: input.completedAt,
        entityId: input.entityId,
        raisedBedFieldId: input.raisedBedFieldId,
        raisedBedId: input.raisedBedId,
        status: input.status ?? 'completed',
    };
}

function operationItem(
    id: number,
    input: {
        completedAt?: string | null;
        entityId: number;
        raisedBedFieldId?: number | null;
        raisedBedId?: number | null;
        status?: string;
    },
): OperationHistoryVisualInput {
    return {
        id,
        canceledAt: null,
        completedAt: input.completedAt ?? null,
        completionNotes: null,
        createdAt: input.completedAt ?? '2026-06-01T08:00:00.000Z',
        entityId: input.entityId,
        imageUrls: [],
        raisedBedFieldId: input.raisedBedFieldId,
        raisedBedId: input.raisedBedId,
        scheduledDate: '2026-06-02T08:00:00.000Z',
        status: input.status ?? 'planned',
        verifiedAt: null,
    };
}

describe('operation visual reward kind mapping', () => {
    it('maps watering to a watering reward without special droplet kind', () => {
        assert.strictEqual(
            resolveOperationVisualRewardKind(operations[0]),
            'watering',
        );
    });

    it('maps removal operations to negative visual families', () => {
        assert.strictEqual(
            resolveOperationVisualRewardKind(operations[2]),
            'removeMulch',
        );
        assert.strictEqual(
            resolveOperationVisualRewardKind(operations[4]),
            'removeAgrotextile',
        );
    });

    it('maps known plant actions', () => {
        assert.strictEqual(
            resolveOperationVisualRewardKind(operations[5]),
            'weeding',
        );
        assert.strictEqual(
            resolveOperationVisualRewardKind(operations[6]),
            'supports',
        );
        assert.strictEqual(
            resolveOperationVisualRewardKind(operations[7]),
            'harvest',
        );
    });

    it('ignores photo operations as visual rewards', () => {
        assert.strictEqual(
            resolveOperationVisualRewardKind(operations[8]),
            null,
        );
    });

    it('does not infer rewards from operation text without the explicit attribute', () => {
        assert.strictEqual(
            resolveOperationVisualRewardKind(
                operation(10, {
                    label: 'Zalijevanje gredice',
                    name: 'wateringRaisedBed',
                    stage: 'watering',
                }),
            ),
            null,
        );
    });

    it('ignores unknown explicit visual reward values', () => {
        assert.strictEqual(
            resolveOperationVisualRewardKind(
                operation(11, {
                    label: 'Zalijevanje gredice',
                    name: 'wateringRaisedBed',
                    visualReward: 'droplets',
                }),
            ),
            null,
        );
    });
});

describe('operation visual reward debug profile', () => {
    it('covers every supported reward kind through explicit attributes', () => {
        const expectedKinds = operationVisualRewardDebugScenarios
            .map((scenario) => scenario.kind)
            .sort();
        const resolvedKinds = operationVisualRewardDebugOperationDefinitions
            .map(resolveOperationVisualRewardKind)
            .filter((kind): kind is OperationVisualRewardKind => kind !== null)
            .sort();

        assert.deepStrictEqual(resolvedKinds, expectedKinds);
        assert.deepStrictEqual(
            operationVisualRewardDebugScenarios.map((scenario) => ({
                after: scenario.after.raisedBedId,
                before: scenario.before.raisedBedId,
                kind: scenario.kind,
                operationId: scenario.operationId,
            })),
            operationVisualRewardDebugOperationDefinitions.map((operation) => ({
                after: operationVisualRewardDebugScenarios.find(
                    (scenario) => scenario.operationId === operation.id,
                )?.after.raisedBedId,
                before: operationVisualRewardDebugScenarios.find(
                    (scenario) => scenario.operationId === operation.id,
                )?.before.raisedBedId,
                kind: resolveOperationVisualRewardKind(operation),
                operationId: operation.id,
            })),
        );
    });
});

describe('resolveOperationVisualRewards', () => {
    it('keeps field and raised-bed scopes separate', () => {
        const rewards = resolveOperationVisualRewards({
            appliedOperations: [
                applied(101, {
                    completedAt: '2026-06-01T08:00:00.000Z',
                    entityId: 1,
                    raisedBedId: 10,
                }),
                applied(102, {
                    completedAt: '2026-06-01T09:00:00.000Z',
                    entityId: 6,
                    raisedBedFieldId: 500,
                    raisedBedId: 10,
                }),
            ],
            operations,
        });

        assert.deepStrictEqual(
            rewards.map((reward) => ({
                kind: reward.kind,
                raisedBedFieldId: reward.raisedBedFieldId,
                raisedBedId: reward.raisedBedId,
                scope: reward.scope,
            })),
            [
                {
                    kind: 'weeding',
                    raisedBedFieldId: 500,
                    raisedBedId: 10,
                    scope: 'field',
                },
                {
                    kind: 'watering',
                    raisedBedFieldId: null,
                    raisedBedId: 10,
                    scope: 'raisedBed',
                },
            ],
        );

        assert.deepStrictEqual(
            filterOperationVisualRewards(rewards, {
                raisedBedFieldId: 500,
                raisedBedId: 10,
            }).map((reward) => reward.kind),
            ['weeding', 'watering'],
        );
        assert.deepStrictEqual(
            filterOperationVisualRewards(rewards, {
                raisedBedId: 10,
            }).map((reward) => reward.kind),
            ['watering'],
        );
    });

    it('lets newer removal operations override older applied layers at the same scope', () => {
        const rewards = resolveOperationVisualRewards({
            appliedOperations: [
                applied(201, {
                    completedAt: '2026-06-01T08:00:00.000Z',
                    entityId: 2,
                    raisedBedId: 10,
                }),
                applied(202, {
                    completedAt: '2026-06-02T08:00:00.000Z',
                    entityId: 3,
                    raisedBedId: 10,
                }),
            ],
            operations,
        });

        assert.equal(rewards.length, 1);
        assert.deepStrictEqual(
            {
                active: rewards[0]?.active,
                family: rewards[0]?.family,
                kind: rewards[0]?.kind,
                polarity: rewards[0]?.polarity,
            },
            {
                active: false,
                family: 'mulch',
                kind: 'removeMulch',
                polarity: 'remove',
            },
        );
    });

    it('keeps older removal from clearing newer applied layers', () => {
        const rewards = resolveOperationVisualRewards({
            appliedOperations: [
                applied(301, {
                    completedAt: '2026-06-01T08:00:00.000Z',
                    entityId: 5,
                    raisedBedId: 10,
                }),
                applied(302, {
                    completedAt: '2026-06-03T08:00:00.000Z',
                    entityId: 4,
                    raisedBedId: 10,
                }),
            ],
            operations,
        });

        assert.equal(rewards.length, 1);
        assert.deepStrictEqual(
            {
                active: rewards[0]?.active,
                kind: rewards[0]?.kind,
                polarity: rewards[0]?.polarity,
            },
            {
                active: true,
                kind: 'agrotextile',
                polarity: 'apply',
            },
        );
    });

    it('ignores planned, failed, canceled, and unknown operation states', () => {
        const rewards = resolveOperationVisualRewards({
            appliedOperations: [
                applied(401, {
                    completedAt: '2026-06-01T08:00:00.000Z',
                    entityId: 1,
                    raisedBedId: 10,
                    status: 'planned',
                }),
                applied(402, {
                    completedAt: '2026-06-01T09:00:00.000Z',
                    entityId: 1,
                    raisedBedId: 10,
                    status: 'failed',
                }),
                applied(403, {
                    completedAt: '2026-06-01T10:00:00.000Z',
                    entityId: 1,
                    raisedBedId: 10,
                    status: 'canceled',
                }),
            ],
            operations,
        });

        assert.deepStrictEqual(rewards, []);
    });

    it('keeps requested harvest items as empty harvest rewards', () => {
        const rewards = resolveOperationVisualRewards({
            operationItems: [
                operationItem(501, {
                    entityId: 8,
                    raisedBedFieldId: 500,
                    raisedBedId: 10,
                    status: 'planned',
                }),
            ],
            operations,
        });

        assert.equal(rewards.length, 1);
        assert.deepStrictEqual(
            {
                completedAt: rewards[0]?.completedAt,
                kind: rewards[0]?.kind,
                operationId: rewards[0]?.operationId,
                status: rewards[0]?.status,
            },
            {
                completedAt: null,
                kind: 'harvest',
                operationId: 501,
                status: 'planned',
            },
        );
    });

    it('keeps completed harvest history as produce-ready rewards', () => {
        const rewards = resolveOperationVisualRewards({
            operationItems: [
                operationItem(502, {
                    completedAt: '2026-06-02T08:00:00.000Z',
                    entityId: 8,
                    raisedBedFieldId: 500,
                    raisedBedId: 10,
                    status: 'completed',
                }),
            ],
            operations,
        });

        assert.equal(rewards[0]?.completedAt, '2026-06-02T08:00:00.000Z');
        assert.equal(rewards[0]?.kind, 'harvest');
    });

    it('does not create visual rewards from operation history photos', () => {
        const rewards = resolveOperationVisualRewards({
            operationItems: [
                {
                    ...applied(501, {
                        completedAt: '2026-06-01T08:00:00.000Z',
                        entityId: 9,
                        raisedBedId: 10,
                        status: 'confirmed',
                    }),
                    imageUrls: [
                        'https://cdn.gredice.com/photo-1.jpg',
                        'https://cdn.gredice.com/photo-2.jpg',
                    ],
                    verifiedAt: null,
                },
            ],
            operations,
        });

        assert.deepStrictEqual(rewards, []);
    });
});
