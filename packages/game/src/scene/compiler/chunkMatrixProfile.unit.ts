import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkCompilerProfileObserver } from './chunkCompilerProfile';
import {
    editChunkMatrixProfile,
    readChunkMatrixProfileCommand,
} from './chunkMatrixProfile';

test('profile edits retain untouched stacks, positions and lower blocks', () => {
    const ground = { name: 'Block_Grass', rotation: 0 };
    const garden = {
        id: 1,
        stacks: Array.from({ length: 64 }, (_, i) => ({
            position: { x: i % 8, y: 0, z: Math.floor(i / 8) },
            blocks: [ground, { name: 'StoneSmall', rotation: i % 4 }],
        })),
    };
    const edited = editChunkMatrixProfile(garden, 8);
    assert.ok(edited);
    assert.equal(edited.changed, 8);
    for (let i = 0; i < 64; i++) {
        assert.equal(
            edited.garden.stacks[i].position,
            garden.stacks[i].position,
        );
        assert.equal(edited.garden.stacks[i].blocks[0], ground);
        if (i < 8)
            assert.equal(
                edited.garden.stacks[i].blocks[1].rotation,
                ((i % 4) + 1) % 4,
            );
        else assert.equal(edited.garden.stacks[i], garden.stacks[i]);
    }
    assert.equal(editChunkMatrixProfile(garden, 65), null);
    for (const value of [
        null,
        {},
        { count: '64', sequence: 1 },
        { count: 64, sequence: 0 },
        { count: 4097, sequence: 1 },
    ])
        assert.equal(readChunkMatrixProfileCommand(value), null);
    assert.deepEqual(
        readChunkMatrixProfileCommand({ count: 64, sequence: 1 }),
        { count: 64, sequence: 1 },
    );
});

test('compiler observations are opt-in and cannot interrupt compiler ownership', () => {
    const previous = globalThis.__grediceChunkCompilerObserver;
    try {
        globalThis.__grediceChunkCompilerObserver = undefined;
        assert.equal(chunkCompilerProfileObserver(), undefined);
        globalThis.__grediceChunkCompilerObserver = () => {
            throw new Error('diagnostic failure');
        };
        assert.doesNotThrow(() =>
            chunkCompilerProfileObserver()?.({ stage: 'write', durationMs: 1 }),
        );
    } finally {
        globalThis.__grediceChunkCompilerObserver = previous;
    }
});
