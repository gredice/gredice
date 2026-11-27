import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import { createGardenPosition, type GardenStack } from '../types/Stack';
import {
    blockEditingAnchorOffsetY,
    findBlockEditingTarget,
    getBlockEditingAnchor,
    isBlockEditingBlockGone,
    isUnsavedBlockId,
} from './blockEditingTarget';

const blockData = getLocalSandboxBlockData();
const grassHeight = 0.4;

function block(id: string, name: string, rotation = 0): Block {
    return { id, name, rotation };
}

function stack(x: number, z: number, blocks: Block[]): GardenStack {
    return { position: createGardenPosition(x, 0, z), blocks };
}

function assertClose(actual: number, expected: number) {
    assert.ok(
        Math.abs(actual - expected) < 1e-9,
        `${actual} is not close to ${expected}`,
    );
}

describe('findBlockEditingTarget', () => {
    it('finds a block by id with its stack, index and drag identity', () => {
        const ball = block('ball', 'BeachBall');
        const garden = {
            stacks: [
                stack(0, 0, [block('g1', 'Block_Grass')]),
                stack(3, -2, [block('g2', 'Block_Grass'), ball]),
            ],
        };

        const target = findBlockEditingTarget(garden, 'ball');
        assert.ok(target);
        assert.equal(target.block, ball);
        assert.equal(target.blockIndex, 1);
        assert.equal(target.stack, garden.stacks[1]);
        assert.deepEqual(target.target, {
            blockId: 'ball',
            blockIndex: 1,
            stackPosition: { x: 3, z: -2 },
        });
    });

    it('follows the block after its stack changes', () => {
        const ball = block('ball', 'BeachBall');
        const before = {
            stacks: [stack(0, 0, [block('g1', 'Block_Grass'), ball])],
        };
        const after = {
            stacks: [
                stack(0, 0, [block('g1', 'Block_Grass')]),
                stack(5, 1, [
                    block('g3', 'Block_Grass'),
                    block('g4', 'Block_Grass'),
                    { ...ball, rotation: 2 },
                ]),
            ],
        };

        assert.equal(findBlockEditingTarget(before, 'ball')?.blockIndex, 1);
        const moved = findBlockEditingTarget(after, 'ball');
        assert.equal(moved?.blockIndex, 2);
        assert.equal(moved?.block.rotation, 2);
        assert.deepEqual(moved?.target.stackPosition, { x: 5, z: 1 });
    });

    it('returns null for a missing block, garden or id', () => {
        const garden = { stacks: [stack(0, 0, [block('g1', 'Block_Grass')])] };
        assert.equal(findBlockEditingTarget(garden, 'gone'), null);
        assert.equal(findBlockEditingTarget(null, 'g1'), null);
        assert.equal(findBlockEditingTarget(undefined, 'g1'), null);
        assert.equal(findBlockEditingTarget(garden, null), null);
    });
});

describe('isBlockEditingBlockGone', () => {
    const withBlock = { stacks: [stack(0, 0, [block('b1', 'Bush')])] };
    // The same garden after a removal's optimistic update took the block out.
    const withoutBlock = { stacks: [stack(0, 0, [])] };

    it('closes the pop-up, Expand and an idle remove dialog when the block is gone', () => {
        for (const mode of ['menu', 'expand', 'confirm-remove'] as const) {
            assert.equal(
                isBlockEditingBlockGone({
                    blockId: 'b1',
                    garden: withoutBlock,
                    mode,
                    removePending: false,
                }),
                true,
                mode,
            );
            assert.equal(
                isBlockEditingBlockGone({
                    blockId: 'b1',
                    garden: withBlock,
                    mode,
                    removePending: false,
                }),
                false,
                mode,
            );
        }
        assert.equal(
            isBlockEditingBlockGone({
                blockId: 'b1',
                garden: null,
                mode: 'menu',
                removePending: false,
            }),
            true,
        );
    });

    it('keeps the remove dialog while its own removal is pending', () => {
        assert.equal(
            isBlockEditingBlockGone({
                blockId: 'b1',
                garden: withoutBlock,
                mode: 'confirm-remove',
                removePending: true,
            }),
            false,
        );
        // After an error the hooks restore the cache and the block is back.
        assert.equal(
            isBlockEditingBlockGone({
                blockId: 'b1',
                garden: withBlock,
                mode: 'confirm-remove',
                removePending: false,
            }),
            false,
        );
    });

    it('ignores a loading garden, moves and no editing', () => {
        assert.equal(
            isBlockEditingBlockGone({
                blockId: 'b1',
                garden: undefined,
                mode: 'menu',
                removePending: false,
            }),
            false,
        );
        for (const mode of ['moving', 'carry', null] as const) {
            assert.equal(
                isBlockEditingBlockGone({
                    blockId: 'b1',
                    garden: withoutBlock,
                    mode,
                    removePending: false,
                }),
                false,
                String(mode),
            );
        }
    });
});

describe('getBlockEditingAnchor', () => {
    it('sits above the block top, over its cell', () => {
        const ball = block('ball', 'BeachBall');
        const target = findBlockEditingTarget(
            { stacks: [stack(2, -4, [block('g1', 'Block_Grass'), ball])] },
            'ball',
        );
        assert.ok(target);

        const [x, y, z] = getBlockEditingAnchor(blockData, target);
        assert.equal(x, 2);
        assert.equal(z, -4);
        assertClose(y, grassHeight + 0.32 + blockEditingAnchorOffsetY);
    });

    it('uses the collapsed height of water on shaped terrain', () => {
        const water = block('water', 'Block_Water');
        const target = findBlockEditingTarget(
            {
                stacks: [
                    stack(0, 0, [block('sand', 'Block_Sand_Angle'), water]),
                ],
            },
            'water',
        );
        assert.ok(target);

        assertClose(
            getBlockEditingAnchor(blockData, target)[1],
            grassHeight + blockEditingAnchorOffsetY,
        );
    });

    it('centres multi-cell blocks on their rotated footprint', () => {
        const boat = (rotation: number) =>
            findBlockEditingTarget(
                {
                    stacks: [
                        stack(1, 1, [block('boat', 'FishingBoat', rotation)]),
                    ],
                },
                'boat',
            );
        const unrotated = boat(0);
        const quarterTurn = boat(1);
        assert.ok(unrotated && quarterTurn);

        // FishingBoat spans 1 × 2 cells.
        const [x0, , z0] = getBlockEditingAnchor(blockData, unrotated);
        assert.deepEqual([x0, z0], [1, 1.5]);
        const [x1, , z1] = getBlockEditingAnchor(blockData, quarterTurn);
        assert.deepEqual([x1, z1], [1.5, 1]);
    });

    it('falls back to the stack position and offset without block data', () => {
        const target = findBlockEditingTarget(
            { stacks: [stack(4, 6, [block('bush', 'Bush')])] },
            'bush',
        );
        assert.ok(target);
        assert.deepEqual(getBlockEditingAnchor(null, target), [
            4,
            blockEditingAnchorOffsetY,
            6,
        ]);
    });
});

describe('isUnsavedBlockId', () => {
    it('matches optimistic placements only', () => {
        assert.equal(isUnsavedBlockId('optimistic-block:Bush:1'), true);
        assert.equal(
            isUnsavedBlockId('optimistic-garden-box-block:Bush:1'),
            true,
        );
        assert.equal(isUnsavedBlockId('local-block:Bush:1:2'), false);
        assert.equal(isUnsavedBlockId('5f0c6c1e-4a1b'), false);
    });
});
