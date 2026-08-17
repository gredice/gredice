import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import {
    chooseNextFarmAnimalTarget,
    createFarmAnimalHabitatsForSpecies,
    getFarmAnimalBehaviorAvailability,
    getFarmAnimalLocomotion,
    resolveFarmAnimalRuntimeForTarget,
} from './FarmAnimals';

function stackWithBlocks(
    x: number,
    z: number,
    blocks: Array<{ id: string; name: string; rotation?: number }>,
): Stack {
    return {
        blocks: blocks.map((block) => ({
            id: block.id,
            name: block.name,
            rotation: block.rotation ?? 0,
        })),
        position: new Vector3(x, 0, z),
    };
}

test('creates exactly one chicken for every placed chicken coop', () => {
    const stacks = [
        stackWithBlocks(0, 0, [
            { id: 'ground-a', name: 'Block_Grass' },
            { id: 'coop-a', name: 'ChickenCoop' },
        ]),
        stackWithBlocks(2, 0, [
            { id: 'ground-b', name: 'Block_Grass' },
            { id: 'coop-b', name: 'ChickenCoop', rotation: 1 },
        ]),
        stackWithBlocks(4, 0, [
            { id: 'ground-c', name: 'Block_Grass' },
            { id: 'pen-a', name: 'PigletPen' },
        ]),
    ];

    const habitats = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Chicken',
        stacks,
    });

    assert.equal(habitats.length, 2);
    assert.deepEqual(
        habitats.map((habitat) => habitat.id),
        ['chicken-home-coop-a', 'chicken-home-coop-b'],
    );
    assert.ok(habitats.every((habitat) => habitat.species === 'Chicken'));
});

test('creates exactly one piglet per pen and none after the pen is removed', () => {
    const stacks = [
        stackWithBlocks(0, 0, [
            { id: 'ground-a', name: 'Block_Grass' },
            { id: 'pen-a', name: 'PigletPen' },
        ]),
        stackWithBlocks(1, 0, [{ id: 'ground-b', name: 'Block_Dry_Ground' }]),
    ];
    const habitats = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Piglet',
        stacks,
    });

    assert.equal(habitats.length, 1);
    assert.equal(habitats[0]?.id, 'piglet-home-pen-a');
    assert.equal(habitats[0]?.wallow?.behavior, 'wallow');

    const withoutPen = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Piglet',
        stacks: stacks.slice(1),
    });
    assert.deepEqual(withoutPen, []);
});

test('does not select special behavior targets outside the home activity range', () => {
    const habitats = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Chicken',
        stacks: [
            stackWithBlocks(0, 0, [
                { id: 'ground-home', name: 'Block_Grass' },
                { id: 'coop', name: 'ChickenCoop' },
            ]),
            stackWithBlocks(8, 0, [
                { id: 'distant-dry-ground', name: 'Block_Dry_Ground' },
            ]),
        ],
    });
    const habitat = habitats[0];
    assert.ok(habitat);
    assert.equal(habitat.dustBaths.length, 1);

    const availability = getFarmAnimalBehaviorAvailability(habitat, 3);
    assert.equal(availability['dust-bathe'], false);
    assert.equal(availability.forage, false);
    assert.equal(availability.roam, false);

    const target = chooseNextFarmAnimalTarget({
        forcedBehavior: 'dust-bathe',
        habitat,
        random: () => 0,
        timeOfDay: 0.5,
        weather: undefined,
    });
    assert.equal(target.behavior, 'home');
    assert.equal(target.id, habitat.home.id);
});

test('settles at the current position instead of teleporting to an unreachable target', () => {
    const habitats = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Piglet',
        stacks: [
            stackWithBlocks(0, 0, [
                { id: 'ground-home', name: 'Block_Grass' },
                { id: 'pen', name: 'PigletPen' },
            ]),
        ],
    });
    const habitat = habitats[0];
    assert.ok(habitat);
    const currentPosition = habitat.home.position.clone();
    const blockedHabitat = {
        ...habitat,
        blockedCells: [
            { x: -1, z: -1 },
            { x: -1, z: 0 },
            { x: -1, z: 1 },
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
        ],
    };

    const runtime = resolveFarmAnimalRuntimeForTarget({
        from: currentPosition,
        habitat: blockedHabitat,
        now: 10,
        random: () => 0,
        target: {
            behavior: 'roam',
            id: 'unreachable',
            position: new Vector3(8, 0, 0),
        },
        timeOfDay: 0.5,
        weather: undefined,
    });

    assert.equal(runtime.phase, 'settled');
    assert.equal(runtime.target.behavior, 'home');
    assert.deepEqual(
        runtime.target.position.toArray(),
        currentPosition.toArray(),
    );
});

test('distinguishes swimming from walking while an animal is moving', () => {
    const habitats = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Piglet',
        stacks: [
            stackWithBlocks(0, 0, [
                { id: 'ground-home', name: 'Block_Grass' },
                { id: 'pen', name: 'PigletPen' },
            ]),
            stackWithBlocks(1, 0, [
                { id: 'water-ground', name: 'Block_Grass' },
                { id: 'water', name: 'Block_Water' },
            ]),
        ],
    });
    const habitat = habitats[0];
    assert.ok(habitat);

    assert.equal(
        getFarmAnimalLocomotion({
            groundSurfaces: habitat.groundSurfaces,
            moving: true,
            position: new Vector3(1, 0, 0),
        }),
        'swimming',
    );
    assert.equal(
        getFarmAnimalLocomotion({
            groundSurfaces: habitat.groundSurfaces,
            moving: true,
            position: habitat.home.position,
        }),
        'walking',
    );
    assert.equal(
        getFarmAnimalLocomotion({
            groundSurfaces: habitat.groundSurfaces,
            moving: false,
            position: new Vector3(1, 0, 0),
        }),
        'settled',
    );
});
