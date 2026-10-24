import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { compileRetainedGardenScene } from './retainedGardenScene';

function stack(x: number, z = 0, name = 'Block_Grass'): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks: [{ id: `${x}:${z}`, name, rotation: 0 }],
    };
}

function clone(stacks: Stack[]) {
    return stacks.map((stack) => ({
        position: stack.position.clone(),
        blocks: stack.blocks.map((block) => ({ ...block })),
    }));
}

describe('retained garden packets', () => {
    it('retains chunks, cells, blocks, bounds, and interactions after server JSON reconciliation', () => {
        const first = compileRetainedGardenScene(
            [stack(-1), stack(1), stack(18)],
            undefined,
        );
        const next = compileRetainedGardenScene(
            clone(first.stacks),
            undefined,
            first,
        );
        assert.strictEqual(next.stacks, first.stacks);
        assert.strictEqual(next.chunks, first.chunks);
        assert.strictEqual(next.interactions, first.interactions);
        assert.deepEqual(next.dirtyChunkKeys, []);
        for (const [key, cell] of first.cells)
            assert.strictEqual(next.cells.get(key), cell);
        assert.equal(next.version, first.version);
    });

    it('changes only the owner on insertion and records removed chunk keys', () => {
        const first = compileRetainedGardenScene(
            [stack(1), stack(18)],
            undefined,
        );
        const second = compileRetainedGardenScene(
            [...first.stacks, stack(2)],
            undefined,
            first,
        );
        assert.deepEqual(second.dirtyChunkKeys, ['0:0']);
        assert.strictEqual(second.chunks[1], first.chunks[1]);
        assert.strictEqual(second.chunks[1]?.bounds, first.chunks[1]?.bounds);
        assert.strictEqual(
            second.chunks[1]?.interactions,
            first.chunks[1]?.interactions,
        );
        const removed = compileRetainedGardenScene(
            [second.stacks[1]],
            undefined,
            second,
        );
        assert.deepEqual(removed.dirtyChunkKeys, ['0:0']);
        assert.strictEqual(removed.chunks[0], second.chunks[1]);
    });

    it('invalidates adjacent topology across a boundary without replacing unaffected bounds', () => {
        const first = compileRetainedGardenScene(
            [stack(7), stack(8), stack(32)],
            undefined,
        );
        const nextStacks = clone(first.stacks);
        nextStacks[0].blocks[0].rotation = 1;
        const next = compileRetainedGardenScene(nextStacks, undefined, first);
        assert.deepEqual(next.dirtyChunkKeys, ['0:0', '1:0']);
        assert.equal(next.chunks[1]?.version, 2);
        assert.strictEqual(next.chunks[1]?.bounds, first.chunks[1]?.bounds);
        assert.strictEqual(
            next.chunks[1]?.interactions,
            first.chunks[1]?.interactions,
        );
        assert.strictEqual(next.chunks[2], first.chunks[2]);
        assert.equal(first.chunks[0]?.version, 1);
        assert.equal(first.stacks[0].blocks[0].rotation, 0);
    });

    it('marks both ends of a move and retains original interaction order', () => {
        const first = compileRetainedGardenScene(
            [stack(18), stack(-4), stack(2)],
            undefined,
        );
        const moved = clone(first.stacks);
        moved[0].position.x = 34;
        const next = compileRetainedGardenScene(moved, undefined, first);
        assert.deepEqual(new Set(next.dirtyChunkKeys), new Set(['2:0', '4:0']));
        assert.deepEqual(
            next.interactions.map(({ block }) => block.id),
            ['18:0', '-4:0', '2:0'],
        );
        assert.strictEqual(next.blocks.get('18:0'), first.blocks.get('18:0'));
    });

    it('normalizes raised beds, asset usage and catalog invalidation', () => {
        const first = compileRetainedGardenScene(
            [stack(1, 0, 'Raised_Bed'), stack(18)],
            undefined,
        );
        assert.deepEqual(first.chunks[0]?.raisedBedIds, ['1:0']);
        assert.equal(first.chunks[0]?.assetUsage.get('Raised_Bed'), 1);
        const next = compileRetainedGardenScene(first.stacks, [], first);
        assert.equal(next.dirtyChunkKeys.length, 2);
        assert.notStrictEqual(next.interactions[0], first.interactions[0]);
    });

    it('does not retain previous gardens after repeated disjoint replacements', () => {
        let scene = compileRetainedGardenScene([], undefined);
        for (let i = 0; i < 250; i++) {
            scene = compileRetainedGardenScene(
                [stack(i * 16)],
                undefined,
                scene,
            );
            assert.equal(scene.cells.size, 1);
            assert.equal(scene.blocks.size, 1);
            assert.equal(scene.chunks.length, 1);
        }
        scene = compileRetainedGardenScene(undefined, undefined, scene);
        assert.equal(scene.chunks.length, 0);
        assert.equal(scene.cells.size, 0);
    });
});
