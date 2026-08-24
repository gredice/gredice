import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import {
    canGoatStartCuriosity,
    chooseNextFarmAnimalTarget,
    createFarmAnimalHabitatsForSpecies,
    getChickenHeadPitch,
    getFarmAnimalBehaviorAvailability,
    getFarmAnimalLocomotion,
    getGoatCuriosityTarget,
    getGoatHeadPitch,
    getGoatPlayHopAmount,
    getPigletHeadPitch,
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

test('uses each placed Goat block as one stable goat home anchor', () => {
    const stacks = [
        stackWithBlocks(0, 0, [
            { id: 'ground-a', name: 'Block_Grass' },
            { id: 'goat-a', name: 'GoatShelter', rotation: 1 },
        ]),
        stackWithBlocks(2, 0, [
            { id: 'ground-b', name: 'Block_Stone' },
            { id: 'goat-b', name: 'GoatShelter', rotation: 3 },
        ]),
        stackWithBlocks(4, 0, [
            { id: 'ground-legacy', name: 'Block_Grass' },
            { id: 'goat-legacy', name: 'Goat' },
        ]),
    ];
    const habitats = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Goat',
        stacks,
    });

    assert.deepEqual(
        habitats.map((habitat) => habitat.id),
        ['goat-home-goat-a', 'goat-home-goat-b'],
    );
    assert.deepEqual(
        habitats.map((habitat) =>
            habitat.home.position
                .toArray()
                .map(
                    (coordinate) => Math.round(coordinate * 1_000) / 1_000 || 0,
                ),
        ),
        [
            [-0.48, 0.024, 0],
            [2.48, 0.024, 0],
        ],
    );
});

test('prefers only connected walkable stone or gravel targets for goat browsing', () => {
    const habitats = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Goat',
        stacks: [
            stackWithBlocks(0, 0, [
                { id: 'ground-home', name: 'Block_Grass' },
                { id: 'goat', name: 'GoatShelter' },
            ]),
            stackWithBlocks(1, 0, [{ id: 'grass', name: 'Block_Grass' }]),
            stackWithBlocks(2, 0, [{ id: 'stone', name: 'Block_Stone' }]),
            stackWithBlocks(3, 0, [
                { id: 'raised-ground', name: 'Block_Stone' },
                { id: 'raised-bed', name: 'Raised_Bed' },
            ]),
        ],
    });
    const habitat = habitats[0];
    assert.ok(habitat);
    assert.deepEqual(
        habitat.rockyAnchors.map((target) => target.position.x),
        [2],
    );

    const target = chooseNextFarmAnimalTarget({
        forcedBehavior: 'browse',
        habitat,
        random: () => 0,
        timeOfDay: 0.5,
        weather: undefined,
    });
    assert.equal(target.behavior, 'browse');
    assert.equal(Math.round(target.position.x), 2);
});

test('keeps goat avatar approach and retreat targets on unoccupied terrain', () => {
    const groundStacks = Array.from({ length: 7 }, (_, index) =>
        stackWithBlocks(index - 3, 0, [
            { id: `ground-${index}`, name: 'Block_Grass' },
        ]),
    );
    groundStacks[3]?.blocks.push({
        id: 'goat',
        name: 'GoatShelter',
        rotation: 0,
    });
    groundStacks[4]?.blocks.push({
        id: 'raised-bed',
        name: 'Raised_Bed',
        rotation: 0,
    });
    const habitat = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Goat',
        stacks: groundStacks,
    })[0];
    assert.ok(habitat);

    const approach = getGoatCuriosityTarget({
        avatarPosition: new Vector3(2.5, 0, 0),
        goatPosition: habitat.home.position,
        habitat,
    });
    assert.ok(approach);
    assert.equal(approach.behavior, 'approach-avatar');
    assert.notEqual(Math.round(approach.position.x), 1);

    const retreat = getGoatCuriosityTarget({
        avatarPosition: new Vector3(0.2, 0, 0),
        goatPosition: habitat.home.position,
        habitat,
    });
    assert.ok(retreat);
    assert.equal(retreat.behavior, 'retreat-avatar');
    assert.ok(retreat.position.distanceTo(new Vector3(0.2, 0.024, 0)) > 1);
});

test('suppresses goat curiosity during sheltering and active retreat cooldowns', () => {
    const eligible = {
        avatarDistance: 0.5,
        canFollowAvatar: false,
        freshAvatar: true,
        nextCuriosityAt: 0,
        now: 10,
        phase: 'settled' as const,
        species: 'Goat' as const,
        targetBehavior: 'chew' as const,
        timeOfDay: 0.5,
        weather: undefined,
    };

    assert.equal(canGoatStartCuriosity(eligible), true);
    assert.equal(canGoatStartCuriosity({ ...eligible, timeOfDay: 0.9 }), false);
    assert.equal(
        canGoatStartCuriosity({
            ...eligible,
            weather: { rainy: 1 },
        }),
        false,
    );
    assert.equal(
        canGoatStartCuriosity({ ...eligible, nextCuriosityAt: 11 }),
        false,
    );
    assert.equal(
        canGoatStartCuriosity({
            ...eligible,
            phase: 'moving',
            targetBehavior: 'retreat-avatar',
        }),
        false,
    );
    assert.equal(
        canGoatStartCuriosity({
            ...eligible,
            phase: 'moving',
            targetBehavior: 'home',
        }),
        false,
    );
});

test('keeps goat cover targets outside the occupied tree cell', () => {
    const stacks = Array.from({ length: 25 }, (_, index) => {
        const x = (index % 5) - 2;
        const z = Math.floor(index / 5) - 2;
        return stackWithBlocks(x, z, [
            { id: `ground-${x}-${z}`, name: 'Block_Grass' },
        ]);
    });
    stacks
        .find((stack) => stack.position.x === -2 && stack.position.z === 0)
        ?.blocks.push({ id: 'goat', name: 'GoatShelter', rotation: 0 });
    stacks
        .find((stack) => stack.position.x === 0 && stack.position.z === 0)
        ?.blocks.push({ id: 'tree', name: 'Tree', rotation: 0 });

    const habitat = createFarmAnimalHabitatsForSpecies({
        blockData: undefined,
        species: 'Goat',
        stacks,
    })[0];
    assert.ok(habitat);
    assert.equal(habitat.covers.length, 1);
    assert.notDeepEqual(
        [
            Math.round(habitat.covers[0]?.position.x ?? 0),
            Math.round(habitat.covers[0]?.position.z ?? 0),
        ],
        [0, 0],
    );
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

test('aims chicken pecking and dust-bathing down instead of backward', () => {
    assert.ok(
        getChickenHeadPitch({
            behavior: 'forage',
            moving: false,
            now: Math.PI / (2 * 5.8),
            swimming: false,
        }) < 0,
    );
    assert.equal(
        getChickenHeadPitch({
            behavior: 'dust-bathe',
            moving: false,
            now: 0,
            swimming: false,
        }),
        -0.28,
    );
    assert.equal(
        getChickenHeadPitch({
            behavior: 'forage',
            moving: true,
            now: Math.PI / (2 * 5.8),
            swimming: false,
        }),
        0,
    );
    assert.equal(
        getChickenHeadPitch({
            behavior: 'roam',
            moving: true,
            now: 0,
            swimming: true,
        }),
        -0.12,
    );
});

test('aims piglet rooting and wallowing down while preserving the swim pose', () => {
    assert.ok(
        getPigletHeadPitch({
            behavior: 'root',
            moving: false,
            now: Math.PI / (2 * 4.6),
            swimming: false,
        }) < -0.5,
    );
    assert.equal(
        getPigletHeadPitch({
            behavior: 'wallow',
            moving: false,
            now: 0,
            swimming: false,
        }),
        -0.12,
    );
    assert.equal(
        getPigletHeadPitch({
            behavior: 'roam',
            moving: true,
            now: 0,
            swimming: true,
        }),
        -0.1,
    );
});

test('poses goat browsing, chewing, alert curiosity, and playful hops distinctly', () => {
    assert.ok(
        getGoatHeadPitch({
            behavior: 'browse',
            moving: false,
            now: 0,
            swimming: false,
        }) < -0.6,
    );
    assert.ok(
        getGoatHeadPitch({
            behavior: 'approach-avatar',
            moving: false,
            now: 0,
            swimming: false,
        }) > 0,
    );
    assert.equal(
        getGoatPlayHopAmount({
            behavior: 'roam',
            moving: false,
            now: Math.PI / (2 * 3.1),
        }),
        0,
    );
    assert.ok(
        getGoatPlayHopAmount({
            behavior: 'play-hop',
            moving: false,
            now: Math.PI / (2 * 3.1),
        }) > 0.99,
    );
});
