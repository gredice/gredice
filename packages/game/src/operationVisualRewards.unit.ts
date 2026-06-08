import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    type AppliedOperationVisualInput,
    filterOperationVisualRewards,
    type OperationHistoryVisualInput,
    type OperationVisualDefinitionInput,
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
    }),
    operation(2, {
        label: 'Malčiranje slamom',
        name: 'mulchStraw',
    }),
    operation(3, {
        label: 'Uklanjanje malča',
        name: 'removeMulch',
    }),
    operation(4, {
        label: 'Postavljanje agrotekstila',
        name: 'agrotextileCover',
    }),
    operation(5, {
        label: 'Uklanjanje agrotekstila',
        name: 'removeAgrotextileCover',
    }),
    operation(6, {
        application: 'plant',
        label: 'Plijevljenje korova',
        name: 'weeding',
    }),
    operation(7, {
        application: 'plant',
        label: 'Postavljanje potpore',
        name: 'plantSupports',
    }),
    operation(8, {
        application: 'plant',
        label: 'Berba plodova',
        name: 'harvestPlant',
        stage: 'harvest',
    }),
    operation(9, {
        label: 'Fotografiranje gredice',
        name: 'raisedBedPhotography',
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

    it('maps known plant and update actions', () => {
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
        assert.strictEqual(
            resolveOperationVisualRewardKind(operations[8]),
            'photographyUpdate',
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

    it('uses operation history images for photography updates', () => {
        const operationItems: OperationHistoryVisualInput[] = [
            {
                ...applied(501, {
                    completedAt: '2026-06-01T08:00:00.000Z',
                    entityId: 9,
                    raisedBedId: 10,
                    status: 'confirmed',
                }),
                imageUrls: [
                    'https://cdn.gredice.com/photo-1.jpg',
                    'https://cdn.gredice.com/photo-1.jpg',
                    'https://cdn.gredice.com/photo-2.jpg',
                ],
                verifiedAt: null,
            },
        ];

        const rewards = resolveOperationVisualRewards({
            operationItems,
            operations,
        });

        assert.equal(rewards.length, 1);
        assert.deepStrictEqual(
            {
                family: rewards[0]?.family,
                imageUrls: rewards[0]?.imageUrls,
                kind: rewards[0]?.kind,
                polarity: rewards[0]?.polarity,
            },
            {
                family: 'photography',
                imageUrls: [
                    'https://cdn.gredice.com/photo-1.jpg',
                    'https://cdn.gredice.com/photo-2.jpg',
                ],
                kind: 'photographyUpdate',
                polarity: 'update',
            },
        );
    });
});
