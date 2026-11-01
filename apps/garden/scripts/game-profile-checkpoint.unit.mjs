import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createGameProfileCheckpoint } from './game-profile-checkpoint.mjs';

test('completed samples survive a later failure and separate invocations do not overwrite evidence', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'game-profile-checkpoint-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const first = await createGameProfileCheckpoint(directory, {
        totalRuns: 2,
    });
    await first.record({
        type: 'completed',
        result: { name: 'first', value: 'line\nbreak' },
    });
    await first.record({
        type: 'failed',
        name: 'second',
        message: 'fixture timeout',
    });
    const expected = await readFile(first.path, 'utf8');
    assert.deepEqual(expected.trim().split('\n').map(JSON.parse), [
        { type: 'header', version: 1, metadata: { totalRuns: 2 } },
        { type: 'completed', result: { name: 'first', value: 'line\nbreak' } },
        { type: 'failed', name: 'second', message: 'fixture timeout' },
    ]);
    const second = await createGameProfileCheckpoint(directory, {
        totalRuns: 1,
    });
    assert.notEqual(second.path, first.path);
    assert.equal(await readFile(first.path, 'utf8'), expected);
});

test('checkpoints reject resettable Playwright output directories', async () => {
    await assert.rejects(
        createGameProfileCheckpoint(
            join(tmpdir(), 'apps', 'garden', 'test-results', 'game-profile'),
            {},
        ),
        /Unsafe/,
    );
});
