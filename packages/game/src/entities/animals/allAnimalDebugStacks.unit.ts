import assert from 'node:assert/strict';
import test from 'node:test';
import { createAllAnimalDebugStacks } from './allAnimalDebugStacks';

function blockNameHistogram(names: string[]) {
    const counts = new Map<string, number>();
    for (const name of names) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return Object.fromEntries(
        Array.from(counts.entries()).sort(([left], [right]) =>
            left.localeCompare(right),
        ),
    );
}

test('all-animal debug stacks retain the exact shared workload', () => {
    const stacks = createAllAnimalDebugStacks();
    const blocks = stacks.flatMap((stack) => stack.blocks);
    const groundBlocks = stacks.flatMap((stack) => stack.blocks.slice(0, 1));
    const detailBlocks = stacks.flatMap((stack) => stack.blocks.slice(1));

    assert.equal(stacks.length, 117);
    assert.equal(groundBlocks.length, 117);
    assert.equal(detailBlocks.length, 30);
    assert.equal(blocks.length, 147);
    assert.equal(stacks.filter((stack) => stack.blocks.length > 1).length, 29);
    assert.equal(Math.max(...stacks.map((stack) => stack.blocks.length)), 3);
    assert.equal(new Set(blocks.map((block) => block.id)).size, 147);
    assert.equal(
        new Set(stacks.map(({ position }) => `${position.x}:${position.z}`))
            .size,
        117,
    );
    const positions = stacks.map(({ position }) => ({ ...position }));
    assert.deepEqual(
        positions,
        positions.toSorted(
            (left, right) => left.x - right.x || left.z - right.z,
        ),
    );
    assert.deepEqual(
        blockNameHistogram(groundBlocks.map((block) => block.name)),
        {
            Block_Dry_Ground: 1,
            Block_Grass: 116,
        },
    );
    assert.deepEqual(
        blockNameHistogram(detailBlocks.map((block) => block.name)),
        {
            BirdHouse: 1,
            Bucket: 1,
            Bush: 1,
            CactusBarrel: 1,
            CactusPricklyPear: 1,
            CatPillow: 1,
            ChickenCoop: 1,
            Composter: 3,
            CowShelter: 2,
            DogHouse: 1,
            GardenBox: 3,
            GoatShelter: 1,
            HorseStable: 1,
            PigletPen: 1,
            Pine: 1,
            RabbitHutch: 1,
            SheepFold: 2,
            StoneMedium: 1,
            Stool: 1,
            Tree: 1,
            Tulip: 3,
            WaterWell: 1,
        },
    );
    assert.equal(
        blocks.some((block) => block.name === 'Raised_Bed'),
        false,
    );
    assert.equal(
        blocks.some(
            (block) =>
                block.id === 'animal-debug:1:CatPillow:-5:0:1' &&
                block.name === 'CatPillow',
        ),
        true,
    );
    assert.equal(
        blocks.some(
            (block) =>
                block.id === 'animal-debug:1:Tulip:0:-3:2' &&
                block.name === 'Tulip',
        ),
        true,
    );
});

test('all-animal debug stacks are fresh for each consumer', () => {
    const first = createAllAnimalDebugStacks();
    const second = createAllAnimalDebugStacks();
    const firstGround = first[0]?.blocks[0];
    const secondGround = second[0]?.blocks[0];

    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first[0], second[0]);
    assert.notStrictEqual(firstGround, secondGround);
    assert.ok(firstGround);
    assert.ok(secondGround);

    firstGround.name = 'Changed_For_Test';
    assert.equal(secondGround.name, 'Block_Grass');
});
