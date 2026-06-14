import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    type MovingSegment,
    resolvePickupPlacementPreviewForRelative,
} from './PickupPlacementResolver';

function createBlock(name: string, id = name): Block {
    return {
        id,
        name,
        rotation: 0,
    };
}

function createStack(x: number, z: number, blocks: Block[]): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks,
    };
}

function createBlockData({
    height = 1,
    id,
    name,
    recycler = false,
    stackable = true,
    spanDepth,
    spanWidth,
}: {
    height?: number;
    id: number;
    name: string;
    recycler?: boolean;
    stackable?: boolean;
    spanDepth?: number;
    spanWidth?: number;
}): BlockData {
    return {
        id,
        entityType: {
            id: 8,
            name: 'block',
            label: 'Blok',
        },
        slug: name,
        information: {
            name,
            shortDescription: name,
            fullDescription: name,
            label: name,
        },
        attributes: {
            height,
            stackable,
            type: 'decoration',
            nightOnlyPurchase: false,
            ...(spanDepth !== undefined ? { spanDepth } : {}),
            ...(spanWidth !== undefined ? { spanWidth } : {}),
        },
        prices: {
            sunflowers: 0,
        },
        functions: {
            recycler,
            raisedBed: name === 'Raised_Bed',
        },
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
    };
}

function createMovingSegment({
    block,
    canRecycle = false,
    sourceStack,
}: {
    block: Block;
    canRecycle?: boolean;
    sourceStack: Stack;
}): MovingSegment {
    return {
        sourceStack,
        sourceStartIndex: sourceStack.blocks.indexOf(block),
        blocks: [block],
        baseHeight: 0,
        canRecycle,
    };
}

const blockData = [
    createBlockData({ id: 1, name: 'Tree' }),
    createBlockData({
        id: 2,
        name: 'GardenBox',
        stackable: false,
    }),
    createBlockData({
        id: 3,
        name: 'RecyclingBin',
        recycler: true,
        stackable: false,
    }),
    createBlockData({
        id: 4,
        name: 'WaterWell',
        stackable: false,
    }),
    createBlockData({
        id: 5,
        name: 'Raised_Bed',
        stackable: false,
    }),
    createBlockData({
        id: 6,
        name: 'Composter',
        recycler: true,
        stackable: false,
    }),
    createBlockData({
        id: 7,
        name: 'LemonadeStand',
        stackable: false,
        spanDepth: 1,
        spanWidth: 2,
    }),
];

describe('resolvePickupPlacementPreviewForRelative', () => {
    it('allows a single non-sandbox block to be stored in a GardenBox', () => {
        const tree = createBlock('Tree', 'tree');
        const gardenBox = createBlock('GardenBox', 'garden-box');
        const sourceStack = createStack(0, 0, [tree]);
        const gardenBoxStack = createStack(1, 0, [gardenBox]);

        const preview = resolvePickupPlacementPreviewForRelative({
            blockData,
            gardenIsSandbox: false,
            localSandboxStorageKey: null,
            movingSegments: [createMovingSegment({ block: tree, sourceStack })],
            relative: new Vector3(1, 0, 0),
            stacks: [sourceStack, gardenBoxStack],
        });

        assert.equal(preview?.hoveredGardenBoxBlockId, 'garden-box');
        assert.equal(preview?.canStoreInGardenBox, true);
        assert.equal(preview?.nextIsBlocked, false);
        assert.equal(preview?.nextIsOverRecycler, false);
        assert.equal(preview?.targetOffsets[0]?.blockId, 'tree');
        assert.equal(preview?.targetOffsets[0]?.hoverHeight, 1);
    });

    it('keeps GardenBox placement blocked in local sandbox gardens', () => {
        const tree = createBlock('Tree', 'tree');
        const gardenBox = createBlock('GardenBox', 'garden-box');
        const sourceStack = createStack(0, 0, [tree]);
        const gardenBoxStack = createStack(1, 0, [gardenBox]);

        const preview = resolvePickupPlacementPreviewForRelative({
            blockData,
            gardenIsSandbox: true,
            localSandboxStorageKey: 'gredice.debug.sandbox.garden.v1',
            movingSegments: [createMovingSegment({ block: tree, sourceStack })],
            relative: new Vector3(1, 0, 0),
            stacks: [sourceStack, gardenBoxStack],
        });

        assert.equal(preview?.hoveredGardenBoxBlockId, 'garden-box');
        assert.equal(preview?.canStoreInGardenBox, false);
        assert.equal(preview?.nextIsBlocked, true);
    });

    it('routes recyclable selections to recycler targets instead of blocking', () => {
        const raisedBed = createBlock('Raised_Bed', 'raised-bed');
        const recycler = createBlock('RecyclingBin', 'recycler');
        const sourceStack = createStack(0, 0, [raisedBed]);
        const recyclerStack = createStack(1, 0, [recycler]);

        const preview = resolvePickupPlacementPreviewForRelative({
            blockData,
            gardenIsSandbox: false,
            localSandboxStorageKey: null,
            movingSegments: [
                createMovingSegment({
                    block: raisedBed,
                    canRecycle: true,
                    sourceStack,
                }),
            ],
            relative: new Vector3(1, 0, 0),
            stacks: [sourceStack, recyclerStack],
        });

        assert.equal(preview?.nextIsOverRecycler, true);
        assert.equal(preview?.nextIsBlocked, false);
        assert.equal(preview?.canStoreInGardenBox, false);
    });

    it('routes recyclable selections to composter recycler targets', () => {
        const raisedBed = createBlock('Raised_Bed', 'raised-bed');
        const composter = createBlock('Composter', 'composter');
        const sourceStack = createStack(0, 0, [raisedBed]);
        const composterStack = createStack(1, 0, [composter]);

        const preview = resolvePickupPlacementPreviewForRelative({
            blockData,
            gardenIsSandbox: false,
            localSandboxStorageKey: null,
            movingSegments: [
                createMovingSegment({
                    block: raisedBed,
                    canRecycle: true,
                    sourceStack,
                }),
            ],
            relative: new Vector3(1, 0, 0),
            stacks: [sourceStack, composterStack],
        });

        assert.equal(preview?.nextIsOverRecycler, true);
        assert.equal(preview?.nextIsBlocked, false);
        assert.equal(preview?.canStoreInGardenBox, false);
    });

    it('does not recycle when the selection is released at its source position', () => {
        const raisedBed = createBlock('Raised_Bed', 'raised-bed');
        const sourceStack = createStack(0, 0, [raisedBed]);

        const preview = resolvePickupPlacementPreviewForRelative({
            blockData,
            gardenIsSandbox: false,
            localSandboxStorageKey: null,
            movingSegments: [
                createMovingSegment({
                    block: raisedBed,
                    canRecycle: true,
                    sourceStack,
                }),
            ],
            relative: new Vector3(0, 0, 0),
            stacks: [sourceStack],
        });

        assert.equal(preview?.nextIsOverRecycler, false);
        assert.equal(preview?.nextIsBlocked, false);
    });

    it('blocks drops onto non-stackable non-recycler targets', () => {
        const tree = createBlock('Tree', 'tree');
        const waterWell = createBlock('WaterWell', 'water-well');
        const sourceStack = createStack(0, 0, [tree]);
        const blockedStack = createStack(1, 0, [waterWell]);

        const preview = resolvePickupPlacementPreviewForRelative({
            blockData,
            gardenIsSandbox: false,
            localSandboxStorageKey: null,
            movingSegments: [createMovingSegment({ block: tree, sourceStack })],
            relative: new Vector3(1, 0, 0),
            stacks: [sourceStack, blockedStack],
        });

        assert.equal(preview?.canStoreInGardenBox, false);
        assert.equal(preview?.nextIsOverRecycler, false);
        assert.equal(preview?.nextIsBlocked, true);
    });

    it('blocks multi-cell drops that overlap a non-stackable footprint cell', () => {
        const stand = createBlock('LemonadeStand', 'stand');
        const waterWell = createBlock('WaterWell', 'water-well');
        const sourceStack = createStack(0, 0, [stand]);
        const supportStack = createStack(1, 0, [createBlock('Tree', 'tree')]);
        const blockedStack = createStack(2, 0, [waterWell]);

        const preview = resolvePickupPlacementPreviewForRelative({
            blockData,
            gardenIsSandbox: false,
            localSandboxStorageKey: null,
            movingSegments: [
                createMovingSegment({ block: stand, sourceStack }),
            ],
            relative: new Vector3(1, 0, 0),
            stacks: [sourceStack, supportStack, blockedStack],
        });

        assert.equal(preview?.nextIsBlocked, true);
    });

    it('blocks multi-cell drops onto uneven support heights', () => {
        const stand = createBlock('LemonadeStand', 'stand');
        const sourceStack = createStack(0, 0, [stand]);
        const supportStack = createStack(1, 0, [createBlock('Tree', 'tree')]);

        const preview = resolvePickupPlacementPreviewForRelative({
            blockData,
            gardenIsSandbox: false,
            localSandboxStorageKey: null,
            movingSegments: [
                createMovingSegment({ block: stand, sourceStack }),
            ],
            relative: new Vector3(1, 0, 0),
            stacks: [sourceStack, supportStack],
        });

        assert.equal(preview?.nextIsBlocked, true);
    });
});
