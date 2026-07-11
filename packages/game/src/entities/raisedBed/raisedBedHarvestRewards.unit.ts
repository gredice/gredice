import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type {
    AppliedOperationVisualInput,
    OperationVisualDefinitionInput,
    OperationVisualRewardKind,
} from '../../operationVisualRewards';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    resolveRaisedBedHarvestBasketPlacement,
    resolveRaisedBedHarvestBasketPlacements,
    resolveRaisedBedHarvestBasketState,
    resolveRaisedBedHarvestPositions,
} from './raisedBedHarvestRewards';

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
        completedAt?: string | null;
        entityId: number;
        raisedBedFieldId?: number | null;
        raisedBedId: number;
        status?: string;
    },
): AppliedOperationVisualInput {
    const timestamp = input.completedAt ?? '2026-06-01T08:00:00.000Z';

    return {
        id,
        completedAt: input.completedAt ?? null,
        createdAt: timestamp,
        entityId: input.entityId,
        raisedBedFieldId: input.raisedBedFieldId,
        raisedBedId: input.raisedBedId,
        scheduledDate: timestamp,
        status: input.status ?? 'completed',
    };
}

function block(name: string, id = name): Block {
    return {
        id,
        name,
        rotation: 0,
    };
}

function stack(x: number, z: number, blocks: Block[]): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks,
    };
}

function blockData({
    height,
    name,
    stackable,
}: {
    height: number;
    name: string;
    stackable: boolean;
}): BlockData {
    return {
        id: name.length,
        entityType: { id: 8, label: 'Block', name: 'block' },
        slug: name,
        information: {
            fullDescription: name,
            label: name,
            name,
            shortDescription: name,
        },
        attributes: {
            height,
            nightOnlyPurchase: false,
            stackable,
            type: 'decoration',
        },
        functions: {
            raisedBed: name === 'Raised_Bed',
            recycler: false,
        },
        prices: { sunflowers: 0 },
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
    };
}

const placementBlockData = [
    blockData({ height: 0.4, name: 'Block_Grass', stackable: true }),
    blockData({ height: 0.35, name: 'Raised_Bed', stackable: false }),
    blockData({ height: 1, name: 'WaterWell', stackable: false }),
];

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

test('planned harvest reward shows an empty basket without marking harvested fields', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(401, {
                completedAt: null,
                entityId: 1,
                raisedBedId: 10,
                status: 'planned',
            }),
        ],
        operations,
    });
    const fields = [
        { active: true, id: 50, plantSortId: 337, positionIndex: 0 },
        { active: true, id: 51, plantSortId: 284, positionIndex: 1 },
    ];

    assert.deepStrictEqual(
        resolveRaisedBedHarvestPositions({
            blockOffset: 0,
            fields,
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
    assert.deepStrictEqual(
        resolveRaisedBedHarvestBasketState({
            fields,
            raisedBedId: 10,
            visualRewards,
        }),
        {
            fillLevel: 'empty',
            operationIds: [401],
            producePlantSortIds: [],
        },
    );
});

test('completed field harvest reward fills a partial basket with matching produce', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(501, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 2,
                raisedBedFieldId: 51,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedHarvestBasketState({
            fields: [
                { active: true, id: 50, plantSortId: 337, positionIndex: 0 },
                { active: true, id: 51, plantSortId: 284, positionIndex: 1 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        {
            fillLevel: 'partial',
            operationIds: [501],
            producePlantSortIds: [284],
        },
    );
});

test('harvest basket stays empty while completed work awaits verification', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(551, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
                status: 'pendingVerification',
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedHarvestBasketState({
            fields: [
                { active: true, id: 50, plantSortId: 337, positionIndex: 0 },
                { active: true, id: 51, plantSortId: 284, positionIndex: 1 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        {
            fillLevel: 'empty',
            operationIds: [551],
            producePlantSortIds: [],
        },
    );
    assert.deepStrictEqual(
        resolveRaisedBedHarvestPositions({
            blockOffset: 0,
            fields: [
                { active: true, id: 50, plantSortId: 337, positionIndex: 0 },
                { active: true, id: 51, plantSortId: 284, positionIndex: 1 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
});

test('completed raised-bed harvest reward fills the basket from occupied fields', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(601, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedHarvestBasketState({
            fields: [
                { active: true, id: 50, plantSortId: 337, positionIndex: 0 },
                { active: true, id: 51, plantSortId: 284, positionIndex: 1 },
                { active: true, id: 52, plantSortId: null, positionIndex: 2 },
                { active: false, id: 53, plantSortId: 353, positionIndex: 3 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        {
            fillLevel: 'full',
            operationIds: [601],
            producePlantSortIds: [337, 284],
        },
    );
});

test('delivery-ready harvest operations hide the basket', () => {
    const visualRewards = resolveOperationVisualRewards({
        appliedOperations: [
            applied(701, {
                completedAt: '2026-06-01T08:00:00.000Z',
                entityId: 1,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.equal(
        resolveRaisedBedHarvestBasketState({
            fields: [
                { active: true, id: 50, plantSortId: 337, positionIndex: 0 },
            ],
            hiddenOperationIds: new Set([701]),
            raisedBedId: 10,
            visualRewards,
        }),
        null,
    );
});

test('harvest basket uses the first free stackable neighbor block', () => {
    assert.deepStrictEqual(
        resolveRaisedBedHarvestBasketPlacement({
            blockData: placementBlockData,
            blockIds: ['bed-0', 'bed-1'],
            stacks: [
                stack(0, 0, [
                    block('Block_Grass'),
                    block('Raised_Bed', 'bed-0'),
                ]),
                stack(0, 1, [
                    block('Block_Grass'),
                    block('Raised_Bed', 'bed-1'),
                ]),
                stack(1, 0, [block('Block_Grass', 'target')]),
            ],
        }),
        {
            position: [1, 0.4, 0],
            rotation: Math.PI / 2,
        },
    );
});

test('harvest basket placement skips occupied non-stackable neighbor blocks', () => {
    assert.deepStrictEqual(
        resolveRaisedBedHarvestBasketPlacement({
            blockData: placementBlockData,
            blockIds: ['bed-0', 'bed-1'],
            stacks: [
                stack(0, 0, [
                    block('Block_Grass'),
                    block('Raised_Bed', 'bed-0'),
                ]),
                stack(0, 1, [
                    block('Block_Grass'),
                    block('Raised_Bed', 'bed-1'),
                ]),
                stack(1, 0, [block('Block_Grass'), block('WaterWell')]),
                stack(-1, 0, [block('Block_Grass', 'target')]),
            ],
        }),
        {
            position: [-1, 0.4, 0],
            rotation: -Math.PI / 2,
        },
    );
});

test('harvest basket placements reserve shared neighboring blocks', () => {
    assert.deepStrictEqual(
        Array.from(
            resolveRaisedBedHarvestBasketPlacements({
                blockData: placementBlockData,
                raisedBeds: [
                    { blockIds: ['bed-10'], raisedBedId: 10 },
                    { blockIds: ['bed-11'], raisedBedId: 11 },
                ],
                stacks: [
                    stack(0, 0, [
                        block('Block_Grass'),
                        block('Raised_Bed', 'bed-10'),
                    ]),
                    stack(1, -1, [
                        block('Block_Grass'),
                        block('Raised_Bed', 'bed-11'),
                    ]),
                    stack(1, 0, [block('Block_Grass', 'shared-target')]),
                    stack(0, -1, [block('Block_Grass', 'second-target')]),
                ],
            }),
        ),
        [
            [
                10,
                {
                    position: [1, 0.4, 0],
                    rotation: Math.PI / 2,
                },
            ],
            [
                11,
                {
                    position: [0, 0.4, -1],
                    rotation: -Math.PI / 2,
                },
            ],
        ],
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
