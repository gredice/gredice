import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    resolveWaterFoamCorners,
    resolveWaterFoamEdges,
    resolveWaterRimExposure,
} from './waterBlockFoam';

function waterBlock(id: string): Block {
    return { id, name: 'Block_Water', rotation: 0 };
}

function swampWaterBlock(id: string): Block {
    return { id, name: 'Block_Swamp_Water', rotation: 0 };
}

function grassBlock(id: string): Block {
    return { id, name: 'Block_Grass', rotation: 0 };
}

function sandBlock(id: string): Block {
    return { id, name: 'Block_Sand', rotation: 0 };
}

function grassAngleBlock(id: string): Block {
    return { id, name: 'Block_Grass_Angle', rotation: 0 };
}

function stack(x: number, z: number, blocks: Block[]): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks,
    };
}

describe('resolveWaterFoamEdges', () => {
    it('removes foam from shared water tile edges', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [waterBlock('water-b')]),
            stack(0, 1, [waterBlock('water-c')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 0, 1, 0],
        );
    });

    it('removes foam between standard and swamp water', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [swampWaterBlock('swamp-water-east')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 0, 1, 1],
        );
    });

    it('keeps foam when adjacent stacks contain no water', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [grassBlock('grass-a')]),
            stack(0, 1, [grassBlock('grass-b'), grassBlock('grass-c')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 1, 1, 1],
        );
    });

    it('removes foam when adjacent water is on the same stack level', () => {
        const blockData = getLocalSandboxBlockData();
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [sandBlock('sand-a'), currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [sandBlock('sand-b'), waterBlock('water-b')]),
            stack(0, 1, [sandBlock('sand-c'), waterBlock('water-c')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                blockData,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 0, 1, 0],
        );
    });

    it('keeps foam when adjacent water is on a lower stack level', () => {
        const blockData = getLocalSandboxBlockData();
        const currentWater = waterBlock('water-upper');
        const currentStack = stack(0, 0, [
            sandBlock('sand-a'),
            waterBlock('water-lower'),
            currentWater,
        ]);
        const stacks = [
            currentStack,
            stack(1, 0, [sandBlock('sand-b'), waterBlock('water-east')]),
            stack(0, 1, [sandBlock('sand-c'), waterBlock('water-south')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                blockData,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 1, 1, 1],
        );
    });

    it('removes foam when shaped and standalone water ranges overlap', () => {
        const blockData = getLocalSandboxBlockData();
        const currentWater = waterBlock('water-shaped');
        const currentStack = stack(0, 0, [
            grassAngleBlock('angle-a'),
            currentWater,
        ]);
        const stacks = [currentStack, stack(1, 0, [waterBlock('water-east')])];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                blockData,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 0, 1, 1],
        );
    });

    it('keeps foam for unplaced water previews', () => {
        const currentWater = waterBlock('water-preview');
        const currentStack = stack(0, 0, [sandBlock('sand-a')]);
        const stacks = [
            currentStack,
            stack(1, 0, [sandBlock('sand-b'), waterBlock('water-east')]),
            stack(0, 1, [sandBlock('sand-c'), waterBlock('water-south')]),
        ];

        assert.deepEqual(
            resolveWaterFoamEdges({
                block: currentWater,
                blockData: getLocalSandboxBlockData(),
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 1, 1, 1],
        );
    });
});

describe('resolveWaterFoamCorners', () => {
    it('adds foam to corners touching non-water diagonally', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(-1, 0, [waterBlock('water-west')]),
            stack(0, -1, [waterBlock('water-north')]),
            stack(1, 0, [waterBlock('water-east')]),
            stack(0, 1, [waterBlock('water-south')]),
            stack(1, 1, [waterBlock('water-southeast')]),
            stack(-1, -1, [grassBlock('grass-northwest')]),
        ];

        assert.deepEqual(
            resolveWaterFoamCorners({
                block: currentWater,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 1, 1, 0],
        );
    });

    it('treats mixed water styles as joined around shoreline corners', () => {
        const currentWater = swampWaterBlock('swamp-water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(-1, 0, [waterBlock('water-west')]),
            stack(0, -1, [waterBlock('water-north')]),
        ];

        assert.deepEqual(
            resolveWaterFoamCorners({
                block: currentWater,
                stack: currentStack,
                stacks,
            }).toArray(),
            [1, 0, 0, 0],
        );
    });
});

describe('resolveWaterRimExposure', () => {
    const blockData = getLocalSandboxBlockData();

    function exposure(block: Block, currentStack: Stack, stacks: Stack[]) {
        const rim = resolveWaterRimExposure({
            block,
            blockData,
            stack: currentStack,
            stacks,
        });
        return { corners: rim.corners.toArray(), edges: rim.edges.toArray() };
    }

    it('rounds every side of a lone water block', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);

        assert.deepEqual(exposure(currentWater, currentStack, [currentStack]), {
            corners: [0, 0, 0, 0],
            edges: [1, 1, 1, 1],
        });
    });

    it('keeps sides at a bank or next to water square', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [grassBlock('grass-east')]),
            stack(0, 1, [waterBlock('water-south')]),
        ];

        assert.deepEqual(
            exposure(currentWater, currentStack, stacks).edges,
            [1, 0, 1, 0],
        );
    });

    it('turns the lip around an open inner corner', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const stacks = [
            currentStack,
            stack(1, 0, [waterBlock('water-east')]),
            stack(0, 1, [waterBlock('water-south')]),
        ];

        assert.deepEqual(exposure(currentWater, currentStack, stacks), {
            corners: [0, 0, 0, 1],
            edges: [1, 0, 1, 0],
        });
    });

    it('rounds the water over a ramp toe but not over its back wall', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        // Rotation 0 rises to +x: on the east the toe faces the water, on
        // the west the back wall stands level with it.
        const stacks = [
            currentStack,
            stack(1, 0, [grassAngleBlock('ramp-east')]),
            stack(-1, 0, [grassAngleBlock('ramp-west')]),
            // Its side runs from the toe up to the back: lower part open.
            stack(0, 1, [grassAngleBlock('ramp-south')]),
        ];

        assert.deepEqual(
            exposure(currentWater, currentStack, stacks).edges,
            [0, 1, 1, 1],
        );
    });

    it('closes an open inner corner only where a corner reaches the top', () => {
        const currentWater = waterBlock('water-a');
        const currentStack = stack(0, 0, [currentWater]);
        const ramp = (id: string, rotation: number): Block => ({
            id,
            name: 'Block_Grass_Angle',
            rotation,
        });
        const stacks = [
            currentStack,
            stack(1, 0, [waterBlock('water-east')]),
            stack(0, 1, [waterBlock('water-south')]),
        ];

        // A ramp rising to +x touches the corner with its toe.
        assert.deepEqual(
            exposure(currentWater, currentStack, [
                ...stacks,
                stack(1, 1, [ramp('ramp-low', 0)]),
            ]).corners,
            [0, 0, 0, 1],
        );
        // Turned round, it touches the corner with its high back edge.
        assert.deepEqual(
            exposure(currentWater, currentStack, [
                ...stacks,
                stack(1, 1, [ramp('ramp-high', 2)]),
            ]).corners,
            [0, 0, 0, 0],
        );
    });

    it('rounds a raised water block above the grass beside it', () => {
        const raisedWater = waterBlock('water-raised');
        const currentStack = stack(0, 0, [grassBlock('base'), raisedWater]);
        const stacks = [currentStack, stack(1, 0, [grassBlock('grass-east')])];

        assert.deepEqual(
            exposure(raisedWater, currentStack, stacks).edges,
            [1, 1, 1, 1],
        );
    });
});
