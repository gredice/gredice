import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { instancedBlockNames } from '../../entities/EntityInstances';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { Block } from '../../types/Block';
import { createGardenPosition, type GardenStack } from '../../types/Stack';
import {
    type BlockExpandEditingState,
    startBlockEditingExpand,
} from '../blockEditingState';
import {
    getBlockExpansionMaxSide,
    planBlockExpansionForGarden,
    resolveBlockExpandStart,
} from './expansionPlanInput';

const blockData = getLocalSandboxBlockData();

function block(id: string, name: string, rotation = 0): Block {
    return { id, name, rotation };
}

function stack(x: number, z: number, blocks: Block[]): GardenStack {
    return { position: createGardenPosition(x, 0, z), blocks };
}

function startExpand(
    garden: { stacks: GardenStack[] },
    blockId: string,
    corner: { x: number; z: number },
): BlockExpandEditingState {
    const target = garden.stacks
        .flatMap((candidate) => candidate.blocks)
        .find((candidate) => candidate.id === blockId);
    assert.ok(target);
    const result = resolveBlockExpandStart({ blockData, blockId, garden });
    assert.ok(result.ok);
    const expand = startBlockEditingExpand(
        {
            mode: 'menu',
            blockId,
            blockName: target.name,
            pointerType: 'mouse',
            openedAt: 0,
            sequence: 1,
        },
        result.start,
        2,
    );
    assert.ok(expand?.mode === 'expand');
    return { ...expand, corner };
}

describe('getBlockExpansionMaxSide', () => {
    it('allows 10 per side for instanced block types and 5 otherwise', () => {
        for (const name of ['Block_Grass', 'Bush', 'Tulip', 'StoneSmall']) {
            assert.ok(instancedBlockNames.includes(name));
            assert.equal(getBlockExpansionMaxSide(name), 10, name);
        }
        for (const name of ['BeachBall', 'Snowman', 'FishingBoat']) {
            assert.equal(instancedBlockNames.includes(name), false);
            assert.equal(getBlockExpansionMaxSide(name), 5, name);
        }
    });
});

describe('resolveBlockExpandStart', () => {
    it('reads the rotation, cell, base height and clamp of the source', () => {
        const garden = {
            stacks: [
                stack(2, 3, [block('grass', 'Block_Grass', 5)]),
                stack(4, 3, [
                    block('base', 'Block_Grass'),
                    block('ball', 'BeachBall', -1),
                ]),
            ],
        };

        assert.deepEqual(
            resolveBlockExpandStart({ blockData, blockId: 'grass', garden }),
            {
                ok: true,
                start: {
                    rotation: 1,
                    source: { x: 2, z: 3 },
                    sourceBaseHeight: 0,
                    maxSide: 10,
                },
            },
        );

        const ball = resolveBlockExpandStart({
            blockData,
            blockId: 'ball',
            garden,
        });
        assert.ok(ball.ok);
        assert.equal(ball.start.rotation, 3);
        assert.deepEqual(ball.start.source, { x: 4, z: 3 });
        assert.ok(Math.abs(ball.start.sourceBaseHeight - 0.4) < 1e-9);
        assert.equal(ball.start.maxSide, 5);
    });

    it('refuses blocks Expand does not support', () => {
        const garden = {
            stacks: [
                stack(0, 0, [block('bed', 'Raised_Bed')]),
                stack(2, 0, [block('boat', 'FishingBoat')]),
                stack(4, 0, [block('coop', 'ChickenCoop')]),
                stack(6, 0, [block('optimistic-block:Bush:1', 'Bush')]),
                stack(8, 0, [block('mystery', 'NotARealBlock')]),
            ],
        };
        const reason = (blockId: string) => {
            const result = resolveBlockExpandStart({
                blockData,
                blockId,
                garden,
            });
            return result.ok ? 'ok' : result.reason;
        };

        assert.equal(reason('bed'), 'raised-bed');
        assert.equal(reason('boat'), 'multi-cell');
        assert.equal(reason('coop'), 'animal');
        assert.equal(reason('optimistic-block:Bush:1'), 'unsaved-block');
        assert.equal(reason('mystery'), 'unknown-block');
        assert.equal(reason('gone'), 'missing-block');
        assert.deepEqual(
            resolveBlockExpandStart({
                blockData: undefined,
                blockId: 'bed',
                garden,
            }),
            { ok: false, reason: 'missing-data' },
        );
    });
});

describe('planBlockExpansionForGarden', () => {
    it('plans terrain into empty cells only', () => {
        const garden = {
            stacks: [
                stack(0, 0, [block('source', 'Block_Grass')]),
                stack(1, 0, [block('taken', 'Block_Grass')]),
                stack(0, 1, [block('other-grass', 'Block_Grass')]),
            ],
        };
        const editing = startExpand(garden, 'source', { x: 2, z: 1 });

        const plan = planBlockExpansionForGarden({
            blockData,
            editing,
            garden,
        });
        assert.ok(plan);
        assert.deepEqual(plan.bounds, {
            minX: 0,
            maxX: 2,
            minY: 0,
            maxY: 1,
            width: 3,
            depth: 2,
        });
        assert.deepEqual(
            plan.cells.map((cell) => `${cell.x},${cell.y}:${cell.status}`),
            [
                '0,0:source',
                '1,0:occupied',
                '2,0:place',
                '0,1:occupied',
                '1,1:place',
                '2,1:place',
            ],
        );
        assert.deepEqual(
            plan.placements.map((placement) => placement.position),
            [
                { x: 1, y: 1 },
                { x: 2, y: 0 },
                { x: 2, y: 1 },
            ],
        );
        assert.equal(plan.skippedCount, 2);
    });

    it('marks cells with an unsaved block as pending', () => {
        const garden = {
            stacks: [
                stack(0, 0, [
                    block('base', 'Block_Grass'),
                    block('ball', 'BeachBall'),
                ]),
                stack(1, 0, [
                    block('base-2', 'Block_Grass'),
                    block('optimistic-block:BeachBall:1', 'BeachBall'),
                ]),
                stack(2, 0, [block('base-3', 'Block_Grass')]),
            ],
        };
        const editing = startExpand(garden, 'ball', { x: 2, z: 0 });

        const plan = planBlockExpansionForGarden({
            blockData,
            editing,
            garden,
        });
        assert.deepEqual(
            plan?.cells.map((cell) => cell.status),
            ['source', 'pending', 'place'],
        );
        assert.deepEqual(plan?.placements, [
            { position: { x: 2, y: 0 }, expectedExistingBlocks: ['base-3'] },
        ]);
    });

    it('clamps the corner to the stored maxSide', () => {
        const garden = { stacks: [stack(0, 0, [block('ball', 'BeachBall')])] };
        const editing = startExpand(garden, 'ball', { x: 30, z: 0 });
        assert.equal(editing.maxSide, 5);

        const plan = planBlockExpansionForGarden({
            blockData,
            editing,
            garden,
        });
        assert.equal(plan?.bounds.width, 5);
        assert.equal(plan?.placements.length, 4);
    });

    it('waits for the garden and block data', () => {
        const garden = {
            stacks: [stack(0, 0, [block('grass', 'Block_Grass')])],
        };
        const editing = startExpand(garden, 'grass', { x: 1, z: 0 });
        assert.equal(
            planBlockExpansionForGarden({
                blockData: undefined,
                editing,
                garden,
            }),
            null,
        );
        assert.equal(
            planBlockExpansionForGarden({ blockData, editing, garden: null }),
            null,
        );
    });
});
