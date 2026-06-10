import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    findSunflowerDropPlacement,
    getSunflowerDropPosition,
    getSunflowerDropSpawnDelayMs,
    SUNFLOWER_DROP_GROUND_Y_OFFSET,
    SUNFLOWER_DROP_MAX_GROUND_DISTANCE,
    SUNFLOWER_DROP_MAX_SPAWN_DELAY_MS,
    SUNFLOWER_DROP_MIN_GROUND_DISTANCE,
    SUNFLOWER_DROP_MIN_SPAWN_DELAY_MS,
    SUNFLOWER_DROP_PARTICLE_Y_OFFSET,
} from './sunflowerDropRewardCore';

const sunflowerBlock: Block = {
    id: 'sunflower-block-1',
    name: 'Sunflower',
    rotation: 0,
};

const sunflowerStack: Stack = {
    blocks: [sunflowerBlock],
    position: new Vector3(3, 0, -2),
};

test('sunflower drop spawn delay is between one and five minutes', () => {
    assert.equal(
        getSunflowerDropSpawnDelayMs(() => 0),
        SUNFLOWER_DROP_MIN_SPAWN_DELAY_MS,
    );
    assert.equal(
        getSunflowerDropSpawnDelayMs(() => 1),
        SUNFLOWER_DROP_MAX_SPAWN_DELAY_MS,
    );

    const midpoint = getSunflowerDropSpawnDelayMs(() => 0.5);
    assert.equal(
        midpoint,
        (SUNFLOWER_DROP_MIN_SPAWN_DELAY_MS +
            SUNFLOWER_DROP_MAX_SPAWN_DELAY_MS) /
            2,
    );
});

test('sunflower drop placement resolves the source sunflower block', () => {
    assert.deepEqual(
        findSunflowerDropPlacement([sunflowerStack], sunflowerBlock.id),
        {
            block: sunflowerBlock,
            stack: sunflowerStack,
        },
    );
    assert.equal(findSunflowerDropPlacement([sunflowerStack], 'missing'), null);
});

test('sunflower drop position lands near the source sunflower on the ground', () => {
    const stackHeight = 0.8;
    const drop = getSunflowerDropPosition({
        placement: {
            block: sunflowerBlock,
            stack: sunflowerStack,
        },
        spawnId: '7a77a42a-79c7-49f8-a68f-cce2f3b1f9d0',
        stackHeight,
    });
    const offsetX = drop.position[0] - sunflowerStack.position.x;
    const offsetZ = drop.position[2] - sunflowerStack.position.z;
    const distance = Math.hypot(offsetX, offsetZ);

    assert.ok(distance >= SUNFLOWER_DROP_MIN_GROUND_DISTANCE);
    assert.ok(distance <= SUNFLOWER_DROP_MAX_GROUND_DISTANCE);
    assert.equal(
        drop.position[1],
        stackHeight + SUNFLOWER_DROP_GROUND_Y_OFFSET,
    );
    assert.equal(
        drop.particlePosition.y,
        stackHeight + SUNFLOWER_DROP_PARTICLE_Y_OFFSET,
    );
});
