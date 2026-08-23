import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import {
    createFarmAnimalHabitatsForSpecies,
    getFarmAnimalBehaviorAvailability,
    getSheepHeadPitch,
    resolveFarmAnimalRuntimeForTarget,
} from './FarmAnimals';
import {
    adjustSheepTargetForFlock,
    getSheepSeparationOffset,
    pickSheepLocomotion,
    scaleSheepSeparationOffset,
} from './sheepBehavior';

function stackWithBlocks(
    x: number,
    z: number,
    blocks: Array<{ id: string; name: string }>,
): Stack {
    return {
        blocks: blocks.map((block) => ({ ...block, rotation: 0 })),
        position: new Vector3(x, 0, z),
    };
}

test('creates one independently seeded habitat for every placed sheep', () => {
    const stacks = [
        stackWithBlocks(0, 0, [
            { id: 'ground-a', name: 'Block_Grass' },
            { id: 'sheep-a', name: 'Sheep' },
        ]),
        stackWithBlocks(2, 0, [
            { id: 'ground-b', name: 'Block_Grass' },
            { id: 'sheep-b', name: 'Sheep' },
        ]),
        stackWithBlocks(1, 1, [
            { id: 'water-ground', name: 'Block_Grass' },
            { id: 'water', name: 'Block_Water' },
        ]),
    ];
    const habitats = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Sheep',
        stacks,
    });

    assert.equal(habitats.length, 2);
    assert.notEqual(habitats[0]?.seed, habitats[1]?.seed);
    assert.equal(habitats[0]?.homeBlock.id, 'sheep-a');
    assert.equal(habitats[0]?.homeStack, stacks[0]);
    assert.equal(habitats[1]?.homeBlock.id, 'sheep-b');
    assert.equal(habitats[1]?.homeStack, stacks[1]);
    assert.ok(
        habitats.every((habitat) =>
            habitat.groundSurfaces.every(
                (surface) => surface.kind === 'ground',
            ),
        ),
    );
    assert.ok(
        habitats.every((habitat) =>
            habitat.groundSurfaces.every(
                (surface) => surface.x !== 1 || surface.z !== 1,
            ),
        ),
    );
});

test('makes grazing and cud-chewing available on safe ground', () => {
    const [habitat] = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Sheep',
        stacks: [
            stackWithBlocks(0, 0, [
                { id: 'ground-home', name: 'Block_Grass' },
                { id: 'sheep', name: 'Sheep' },
            ]),
            stackWithBlocks(1, 0, [{ id: 'ground-roam', name: 'Block_Grass' }]),
        ],
    });
    assert.ok(habitat);
    const availability = getFarmAnimalBehaviorAvailability(habitat, 4);
    assert.equal(availability.graze, true);
    assert.equal(availability['chew-cud'], true);
});

test('leaves a lone sheep target unchanged', () => {
    assert.deepEqual(
        adjustSheepTargetForFlock({
            animalId: 'sheep-a',
            from: { x: 0, z: 0 },
            neighbors: [],
            target: { x: 2, z: 1 },
        }),
        { x: 2, z: 1 },
    );
});

test('combines gentle cohesion with deterministic overlap separation', () => {
    const cohesive = adjustSheepTargetForFlock({
        animalId: 'sheep-a',
        from: { x: 0, z: 0 },
        neighbors: [{ id: 'sheep-b', x: 3, z: 0 }],
        target: { x: 0, z: 2 },
    });
    assert.ok(cohesive.x > 0);

    const first = getSheepSeparationOffset({
        animalId: 'sheep-a',
        from: { x: 1, z: 1 },
        neighbors: [{ id: 'sheep-b', x: 1, z: 1 }],
    });
    const repeated = getSheepSeparationOffset({
        animalId: 'sheep-a',
        from: { x: 1, z: 1 },
        neighbors: [{ id: 'sheep-b', x: 1, z: 1 }],
    });
    assert.deepEqual(first, repeated);
    assert.ok(Math.hypot(first.x, first.z) > 0);
});

test('keeps separation speed stable across render frame rates', () => {
    const offset = { x: 0.045, z: -0.03 };
    assert.deepEqual(
        scaleSheepSeparationOffset({ delta: 1 / 60, offset }),
        offset,
    );
    assert.deepEqual(scaleSheepSeparationOffset({ delta: 1 / 120, offset }), {
        x: 0.0225,
        z: -0.015,
    });
    assert.deepEqual(scaleSheepSeparationOffset({ delta: 1, offset }), offset);
});

test('uses short trots only for suitable journeys', () => {
    assert.equal(pickSheepLocomotion({ distance: 2, random: () => 0 }), 'trot');
    assert.equal(
        pickSheepLocomotion({ distance: 2, random: () => 0.9 }),
        'walk',
    );
    assert.equal(pickSheepLocomotion({ distance: 5, random: () => 0 }), 'walk');
});

test('resolves sheep routes around blockers and exposes a grazing pose', () => {
    const [habitat] = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Sheep',
        stacks: [
            stackWithBlocks(0, 0, [
                { id: 'ground-home', name: 'Block_Grass' },
                { id: 'sheep', name: 'Sheep' },
            ]),
            stackWithBlocks(1, 0, [
                { id: 'ground-blocked', name: 'Block_Grass' },
                { id: 'fence', name: 'Fence' },
            ]),
            stackWithBlocks(0, 1, [
                { id: 'ground-detour', name: 'Block_Grass' },
            ]),
            stackWithBlocks(1, 1, [
                { id: 'ground-target', name: 'Block_Grass' },
            ]),
        ],
    });
    assert.ok(habitat);
    const runtime = resolveFarmAnimalRuntimeForTarget({
        from: habitat.home.position,
        habitat,
        now: 0,
        random: () => 0.9,
        target: {
            behavior: 'graze',
            id: 'safe-target',
            position: new Vector3(1, 0, 1),
        },
        timeOfDay: 0.5,
        weather: undefined,
    });
    assert.equal(runtime.phase, 'moving');
    if (runtime.phase === 'moving') {
        assert.ok(
            runtime.path.every((point) => point.x !== 1 || point.z !== 0),
        );
    }
    assert.ok(
        getSheepHeadPitch({ behavior: 'graze', moving: false, now: 1 }) < -0.7,
    );
    assert.ok(
        getSheepHeadPitch({ behavior: 'roam', moving: true, now: 1 }) > -0.1,
    );
});
