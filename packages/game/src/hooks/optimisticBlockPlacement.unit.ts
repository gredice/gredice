import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import {
    createOptimisticBlockPlacement,
    type PlacementBlockData,
    removeOptimisticBlockId,
    replaceOptimisticBlockId,
} from './optimisticBlockPlacement';

const blockData: PlacementBlockData[] = [
    {
        information: { name: 'Block_Grass' },
        attributes: { stackable: true, height: 1 },
    },
    {
        information: { name: 'Block_Water' },
        attributes: { stackable: true, height: 1, placeableOnWater: true },
    },
    {
        information: { name: 'Raised_Bed' },
        attributes: { stackable: true, height: 1 },
    },
    {
        information: { name: 'Shade' },
        attributes: { stackable: false, height: 1 },
    },
];

const maxSpiralSteps = 1000;

function spiral(step: number) {
    const r = Math.floor((Math.sqrt(step + 1) - 1) / 2) + 1;
    const p = (8 * r * (r - 1)) / 2;
    const en = r * 2;
    const a = (1 + step - p) % (r * 8);

    switch (Math.floor(a / (r * 2))) {
        case 0:
            return { x: a - r, z: -r };
        case 1:
            return { x: r, z: (a % en) - r };
        case 2:
            return { x: r - (a % en), z: r };
        case 3:
            return { x: -r, z: r - (a % en) };
        default:
            return { x: 0, z: 0 };
    }
}

function createWaterOnlyGarden() {
    return {
        stacks: [
            {
                position: new Vector3(0, 0, 0),
                blocks: [
                    {
                        id: 'water-origin',
                        name: 'Block_Water',
                        rotation: 0,
                    },
                ],
            },
            ...Array.from({ length: maxSpiralSteps }, (_, step) => {
                const { x, z } = spiral(step);
                return {
                    position: new Vector3(x, 0, z),
                    blocks: [
                        {
                            id: `water-${step}`,
                            name: 'Block_Water',
                            rotation: 0,
                        },
                    ],
                };
            }),
        ],
    };
}

describe('createOptimisticBlockPlacement', () => {
    it('uses the shared placement resolver for new block purchases', () => {
        const placement = createOptimisticBlockPlacement(
            {
                stacks: [
                    {
                        position: new Vector3(0, 0, 0),
                        blocks: [
                            {
                                id: 'grass-a',
                                name: 'Block_Grass',
                                rotation: 0,
                            },
                            {
                                id: 'bed-a',
                                name: 'Raised_Bed',
                                rotation: 0,
                            },
                        ],
                    },
                    {
                        position: new Vector3(1, 0, 0),
                        blocks: [
                            {
                                id: 'grass-b',
                                name: 'Block_Grass',
                                rotation: 0,
                            },
                            {
                                id: 'bed-b',
                                name: 'Raised_Bed',
                                rotation: 0,
                            },
                        ],
                    },
                ],
            },
            blockData,
            'Raised_Bed',
            'optimistic-bed',
        );

        assert.ok(placement);
        assert.deepStrictEqual(placement.position, new Vector3(-1, 0, 1));
        assert.deepStrictEqual(placement.stacks.at(-1), {
            position: new Vector3(-1, 0, 1),
            blocks: [
                {
                    id: 'optimistic-bed',
                    name: 'Raised_Bed',
                    rotation: 0,
                },
            ],
        });
    });

    it('avoids water stacks when automatically placing new blocks', () => {
        const placement = createOptimisticBlockPlacement(
            {
                stacks: [
                    {
                        position: new Vector3(0, 0, 0),
                        blocks: [
                            {
                                id: 'water-a',
                                name: 'Block_Water',
                                rotation: 0,
                            },
                        ],
                    },
                ],
            },
            blockData,
            'Shade',
            'optimistic-shade',
        );

        assert.ok(placement);
        assert.deepStrictEqual(placement.position, new Vector3(0, 0, -1));
        assert.deepStrictEqual(placement.stacks.at(-1), {
            position: new Vector3(0, 0, -1),
            blocks: [
                {
                    id: 'optimistic-shade',
                    name: 'Shade',
                    rotation: 0,
                },
            ],
        });
    });

    it('does not place new non-water blocks on water-only gardens', () => {
        const placement = createOptimisticBlockPlacement(
            createWaterOnlyGarden(),
            blockData,
            'Shade',
            'optimistic-shade',
        );

        assert.equal(placement, null);
    });

    it('allows new water blocks on water-only gardens', () => {
        const placement = createOptimisticBlockPlacement(
            createWaterOnlyGarden(),
            blockData,
            'Block_Water',
            'optimistic-water',
        );

        assert.ok(placement);
        assert.deepStrictEqual(placement.position, new Vector3(0, 0, 0));
        assert.deepStrictEqual(placement.stacks[0], {
            position: new Vector3(0, 0, 0),
            blocks: [
                {
                    id: 'water-origin',
                    name: 'Block_Water',
                    rotation: 0,
                },
                {
                    id: 'optimistic-water',
                    name: 'Block_Water',
                    rotation: 0,
                },
            ],
        });
    });
});

describe('replaceOptimisticBlockId', () => {
    it('keeps the optimistic placement while adopting the backend id', () => {
        const garden = {
            stacks: [
                {
                    position: new Vector3(0, 0, 0),
                    blocks: [
                        {
                            id: 'optimistic-shade',
                            name: 'Shade',
                            rotation: 0,
                        },
                    ],
                },
            ],
        };

        assert.deepStrictEqual(
            replaceOptimisticBlockId(garden, 'optimistic-shade', 'shade-1'),
            {
                stacks: [
                    {
                        position: new Vector3(0, 0, 0),
                        blocks: [
                            {
                                id: 'shade-1',
                                name: 'Shade',
                                rotation: 0,
                            },
                        ],
                    },
                ],
            },
        );
    });
});

describe('removeOptimisticBlockId', () => {
    it('removes only the failed optimistic block from a shared stack', () => {
        const garden = {
            stacks: [
                {
                    position: new Vector3(0, 0, 0),
                    blocks: [
                        {
                            id: 'block-a',
                            name: 'Block_Grass',
                            rotation: 0,
                        },
                        {
                            id: 'optimistic-shade',
                            name: 'Shade',
                            rotation: 0,
                        },
                        {
                            id: 'optimistic-stool',
                            name: 'Stool',
                            rotation: 0,
                        },
                    ],
                },
            ],
        };

        assert.deepStrictEqual(
            removeOptimisticBlockId(garden, 'optimistic-shade'),
            {
                stacks: [
                    {
                        position: new Vector3(0, 0, 0),
                        blocks: [
                            {
                                id: 'block-a',
                                name: 'Block_Grass',
                                rotation: 0,
                            },
                            {
                                id: 'optimistic-stool',
                                name: 'Stool',
                                rotation: 0,
                            },
                        ],
                    },
                ],
            },
        );
    });

    it('removes the optimistic-only stack on rollback', () => {
        const garden = {
            stacks: [
                {
                    position: new Vector3(1, 0, 0),
                    blocks: [
                        {
                            id: 'optimistic-shade',
                            name: 'Shade',
                            rotation: 0,
                        },
                    ],
                },
            ],
        };

        assert.deepStrictEqual(
            removeOptimisticBlockId(garden, 'optimistic-shade'),
            {
                stacks: [],
            },
        );
    });
});
