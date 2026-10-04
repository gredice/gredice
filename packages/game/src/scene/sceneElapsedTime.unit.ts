import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneElapsedTimeReader } from './sceneElapsedTime';

test('semantic scene time advances through idle/hidden periods without animation frames', () => {
    let now = 1234;
    const read = createSceneElapsedTimeReader(
        () => now,
        () => undefined,
    );
    assert.equal(read(), 0);
    now += 90_000;
    assert.equal(read(), 90);
    now += 360_000;
    assert.equal(read(), 450);
});

test('one stable reader switches between exact frozen time and provider lifetime elapsed time', () => {
    let now = 1000;
    let fixed: number | undefined = 0;
    const read = createSceneElapsedTimeReader(
        () => now,
        () => fixed,
    );
    now += 90_000;
    assert.equal(read(), 0);
    fixed = 128.25;
    assert.equal(read(), 128.25);
    fixed = undefined;
    assert.equal(read(), 90);
});
