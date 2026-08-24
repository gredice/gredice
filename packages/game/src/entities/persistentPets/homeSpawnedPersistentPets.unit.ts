import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { getHomeSpawnedPersistentPetInstances } from './homeSpawnedPersistentPets';

function stackWithBlocks(x: number, names: string[]): Stack {
    return {
        blocks: names.map((name, index) => ({
            id: `${name}-${index.toString()}`,
            name,
            rotation: 0,
        })),
        position: new Vector3(x, 0, 0),
    };
}

test('creates one roaming actor per new persistent home and ignores legacy direct aliases', () => {
    const instances = getHomeSpawnedPersistentPetInstances([
        stackWithBlocks(0, ['RabbitHutch', 'Rabbit']),
        stackWithBlocks(2, ['HorseStable', 'Horse']),
        stackWithBlocks(4, ['CowShelter', 'Cow']),
    ]);

    assert.deepEqual(
        instances.map(({ name }) => name),
        ['RabbitHutch', 'HorseStable', 'CowShelter'],
    );
    assert.equal(new Set(instances.map(({ block }) => block.id)).size, 3);
});
