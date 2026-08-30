'use client';

import { createAllAnimalDebugStacks } from '@gredice/game';
import { Button } from '@gredice/ui/Button';
import { Reset } from '@gredice/ui/icons';

type StoredSandboxBlock = {
    id: string;
    name: string;
    rotation: number;
    variant?: number | null;
};

type StoredSandboxStack = {
    blocks: StoredSandboxBlock[];
    position: {
        x: number;
        z: number;
    };
};

type SandboxBounds = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

const animalDebugStorageVersion = 1;

function stackKey(x: number, z: number) {
    return `${x}:${z}`;
}

function createGroundStacks(bounds: SandboxBounds) {
    const stacks = new Map<string, StoredSandboxStack>();

    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
            stacks.set(stackKey(x, z), {
                position: { x, z },
                blocks: [
                    {
                        id: `animal-debug-ground:${x}:${z}`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            });
        }
    }

    return stacks;
}

function placeBlock(
    stacks: Map<string, StoredSandboxStack>,
    x: number,
    z: number,
    name: string,
    rotation = 0,
    variant?: number,
) {
    const stack = stacks.get(stackKey(x, z));
    if (!stack) {
        return;
    }

    stack.blocks.push({
        id: `animal-debug:${animalDebugStorageVersion}:${name}:${x}:${z}:${stack.blocks.length}`,
        name,
        rotation,
        variant,
    });
}

function replaceGround(
    stacks: Map<string, StoredSandboxStack>,
    x: number,
    z: number,
    name:
        | 'Block_Dry_Ground'
        | 'Block_Gravel'
        | 'Block_Sand'
        | 'Block_Stone'
        | 'Block_Swamp_Ground'
        | 'Block_Water',
) {
    const stack = stacks.get(stackKey(x, z));
    const ground = stack?.blocks[0];
    if (!ground) {
        return;
    }
    ground.name = name;
}

function serializeStacks(stacks: Map<string, StoredSandboxStack>) {
    return Array.from(stacks.values()).sort((left, right) => {
        if (left.position.x !== right.position.x) {
            return left.position.x - right.position.x;
        }

        return left.position.z - right.position.z;
    });
}

function createCatPathfindingStacks() {
    const stacks = createGroundStacks({
        minX: -5,
        maxX: 5,
        minZ: -3,
        maxZ: 3,
    });

    placeBlock(stacks, -4, 0, 'CatPillow');
    placeBlock(stacks, 3, 0, 'Tree');
    placeBlock(stacks, 2, -1, 'Stool');
    placeBlock(stacks, 2, 1, 'Bucket');
    placeBlock(stacks, -3, 2, 'StoneMedium');

    for (let z = -3; z <= 1; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
    }

    return serializeStacks(stacks);
}

function createDogPathfindingStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, 0, 'DogHouse');
    placeBlock(stacks, 4, 0, 'Tree');
    placeBlock(stacks, 3, -2, 'Stool');
    placeBlock(stacks, 2, 2, 'Bucket');
    placeBlock(stacks, -4, 3, 'StoneMedium');

    for (let z = -4; z <= 2; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
    }

    return serializeStacks(stacks);
}

function createChickenPathfindingStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, 0, 'ChickenCoop');
    placeBlock(stacks, 4, 0, 'Tree');
    replaceGround(stacks, 3, 2, 'Block_Dry_Ground');
    replaceGround(stacks, -2, -2, 'Block_Sand');

    for (let z = -4; z <= 2; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
    }

    return serializeStacks(stacks);
}

function createPigletPathfindingStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, 0, 'PigletPen');
    placeBlock(stacks, 4, 0, 'Tree');
    placeBlock(stacks, 3, -2, 'Bucket');
    placeBlock(stacks, -3, 3, 'StoneMedium');

    for (let z = -4; z <= 2; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
    }

    return serializeStacks(stacks);
}

function createCowHerdStacks() {
    const stacks = createGroundStacks({
        minX: -7,
        maxX: 7,
        minZ: -5,
        maxZ: 5,
    });

    placeBlock(stacks, -5, -3, 'CowShelter', 0, 0);
    placeBlock(stacks, -5, 1, 'CowShelter', 1, 1);
    placeBlock(stacks, 3, -1, 'CowShelter', 2, 0);
    placeBlock(stacks, 0, -4, 'Tree');
    placeBlock(stacks, 0, 4, 'WaterWell');
    placeBlock(stacks, 2, -3, 'StoneLarge');
    placeBlock(stacks, -1, 3, 'Bucket');

    for (let z = -5; z <= 5; z += 1) {
        if (z < -1 || z > 1) {
            replaceGround(stacks, 1, z, 'Block_Water');
        }
    }
    for (let z = -2; z <= 2; z += 1) {
        if (z !== 0) {
            placeBlock(stacks, -1, z, 'GardenBox');
        }
    }

    return serializeStacks(stacks);
}

function createSheepPathfindingStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, -3, 'SheepFold');
    placeBlock(stacks, -5, 1, 'SheepFold');
    placeBlock(stacks, -2, -1, 'SheepFold');
    placeBlock(stacks, 3, -2, 'Tree');
    placeBlock(stacks, 3, 2, 'StoneMedium');
    for (let z = -4; z <= 1; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
    }
    for (let x = 2; x <= 5; x += 1) {
        placeBlock(stacks, x, 0, 'Block_Water');
    }

    return serializeStacks(stacks);
}

function createGoatPathfindingStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, 0, 'GoatShelter', 1);
    placeBlock(stacks, 4, 0, 'Tree');
    replaceGround(stacks, 3, -2, 'Block_Stone');
    replaceGround(stacks, 3, 2, 'Block_Gravel');

    for (let z = -4; z <= 2; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Raised_Bed');
    }

    return serializeStacks(stacks);
}

function createRabbitPathfindingStacks() {
    const stacks = createGroundStacks({
        minX: -5,
        maxX: 5,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, 1, 0, 'RabbitHutch', 0, 0);
    placeBlock(stacks, 4, -2, 'Tree');
    placeBlock(stacks, -3, 3, 'StoneMedium');
    for (let z = -4; z <= 1; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
    }

    return serializeStacks(stacks);
}

function createHorsePathfindingStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, -1, 'HorseStable', 0, 0);
    placeBlock(stacks, 4, 0, 'Tree');
    placeBlock(stacks, 3, -2, 'StoneLarge');
    placeBlock(stacks, -2, 3, 'WaterWell');
    for (let z = -4; z <= 2; z += 1) {
        if (z !== -1) {
            placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
        }
    }

    return serializeStacks(stacks);
}

function createBirdStacks() {
    const stacks = createGroundStacks({
        minX: -4,
        maxX: 4,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -3, -2, 'BirdHouse');
    placeBlock(stacks, 2, 1, 'Tree');
    placeBlock(stacks, -1, 1, 'Bush');
    placeBlock(stacks, 0, 0, 'StoneLarge');
    placeBlock(stacks, 3, -2, 'WaterWell');
    placeBlock(stacks, -2, 2, 'Tulip');

    return serializeStacks(stacks);
}

function createBeeStacks() {
    const stacks = createGroundStacks({
        minX: -4,
        maxX: 4,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -2, -1, 'Tulip');
    placeBlock(stacks, 0, 1, 'Tulip');
    placeBlock(stacks, 2, -2, 'Tulip');
    placeBlock(stacks, 3, 2, 'CactusBarrel');
    placeBlock(stacks, -3, 2, 'CactusPricklyPear');

    return serializeStacks(stacks);
}

function createSquirrelStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -4, 0, 'Tree');
    placeBlock(stacks, 4, 1, 'Pine');
    placeBlock(stacks, -1, -2, 'GardenBox');
    placeBlock(stacks, 1, 2, 'Composter');
    placeBlock(stacks, 0, -3, 'Bucket');
    for (let z = -4; z <= 1; z += 1) {
        if (z !== -1) {
            placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
        }
    }

    return serializeStacks(stacks);
}

function createLadybugStacks() {
    const stacks = createGroundStacks({
        minX: -4,
        maxX: 4,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -3, -2, 'Tulip');
    placeBlock(stacks, -1, 1, 'Tulip');
    placeBlock(stacks, 2, -2, 'CactusBarrel');
    placeBlock(stacks, 3, 2, 'CactusPricklyPear');
    placeBlock(stacks, 0, 0, 'GardenBox');

    return serializeStacks(stacks);
}

function createFrogWetlandStacks() {
    const stacks = createGroundStacks({
        minX: -5,
        maxX: 5,
        minZ: -4,
        maxZ: 4,
    });

    for (let x = -4; x <= 3; x += 1) {
        for (let z = -3; z <= 3; z += 1) {
            replaceGround(stacks, x, z, 'Block_Swamp_Ground');
        }
    }

    for (let x = -2; x <= 1; x += 1) {
        for (let z = -2; z <= 1; z += 1) {
            placeBlock(stacks, x, z, 'Block_Swamp_Water');
        }
    }

    // One deliberately deep water cell and two blockers make invalid routing
    // visible from the normal game camera.
    placeBlock(stacks, -1, -1, 'Block_Swamp_Water');
    placeBlock(stacks, 2, -1, 'GardenBox');
    placeBlock(stacks, 2, 0, 'Composter');

    return serializeStacks(stacks);
}

function createBatStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, -3, 'Tree');
    placeBlock(stacks, 5, 3, 'Pine');
    placeBlock(stacks, -4, 3, 'Bush');
    placeBlock(stacks, 4, -3, 'DeadTreeTall');
    placeBlock(stacks, 0, 0, 'GardenBox');
    placeBlock(stacks, 1, 0, 'Composter');
    placeBlock(stacks, -1, 1, 'WaterWell');
    placeBlock(stacks, 2, -1, 'Tree');

    return serializeStacks(stacks);
}

function createButterflyStacks() {
    const stacks = createGroundStacks({
        minX: -4,
        maxX: 4,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -2, -1, 'Tulip');
    placeBlock(stacks, 0, 1, 'Tulip');
    placeBlock(stacks, 2, -2, 'Tulip');
    placeBlock(stacks, -3, 2, 'CactusPricklyPear');
    placeBlock(stacks, 3, 2, 'CactusBarrel');
    placeBlock(stacks, 0, 0, 'StoneLarge');
    placeBlock(stacks, 1, 0, 'Tree');

    return serializeStacks(stacks);
}

function persistAnimalDebugStacks(
    storageKey: string,
    stacks: StoredSandboxStack[],
) {
    window.localStorage.setItem(
        storageKey,
        JSON.stringify({
            stacks: stacks.map((stack) => ({
                blocks: stack.blocks.map((block) => ({
                    id: block.id,
                    name: block.name,
                    rotation: block.rotation,
                    variant: block.variant,
                })),
                position: {
                    x: stack.position.x,
                    z: stack.position.z,
                },
            })),
        }),
    );
    window.location.reload();
}

export function AnimalDebugActions({ storageKey }: { storageKey: string }) {
    const reset = () => {
        window.localStorage.removeItem(storageKey);
        window.location.reload();
    };

    return (
        <div className="pointer-events-none absolute left-2 top-2 z-20 flex max-w-[calc(100vw-1rem)] flex-wrap gap-1.5">
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(storageKey, createBatStacks())
                }
                size="sm"
                variant="soft"
            >
                Bats
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createAllAnimalDebugStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                All animals
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createCatPathfindingStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Cat path
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createDogPathfindingStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Dog path
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createChickenPathfindingStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Chicken path
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createPigletPathfindingStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Piglet path
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(storageKey, createCowHerdStacks())
                }
                size="sm"
                variant="soft"
            >
                Cow herd
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createSheepPathfindingStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Sheep flock
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createGoatPathfindingStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Goat path
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createRabbitPathfindingStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Rabbit path
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createHorsePathfindingStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Horse path
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(storageKey, createBirdStacks())
                }
                size="sm"
                variant="soft"
            >
                Birds
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(storageKey, createBeeStacks())
                }
                size="sm"
                variant="soft"
            >
                Bees
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(storageKey, createSquirrelStacks())
                }
                size="sm"
                variant="soft"
            >
                Squirrels
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(storageKey, createLadybugStacks())
                }
                size="sm"
                variant="soft"
            >
                Ladybugs
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createFrogWetlandStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Frog wetland
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={() =>
                    persistAnimalDebugStacks(
                        storageKey,
                        createButterflyStacks(),
                    )
                }
                size="sm"
                variant="soft"
            >
                Butterflies
            </Button>
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={reset}
                size="sm"
                startDecorator={<Reset className="size-4" />}
                variant="soft"
            >
                Reset
            </Button>
        </div>
    );
}
