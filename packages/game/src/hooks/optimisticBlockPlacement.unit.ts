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
        information: { name: 'Raised_Bed' },
        attributes: { stackable: true, height: 1 },
    },
    {
        information: { name: 'Shade' },
        attributes: { stackable: false, height: 1 },
    },
];

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
