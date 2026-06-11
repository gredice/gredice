'use client';

import { Button } from '@gredice/ui/Button';
import { Reset } from '@gredice/ui/icons';

type StoredSandboxBlock = {
    id: string;
    name: string;
    rotation: number;
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
) {
    const stack = stacks.get(stackKey(x, z));
    if (!stack) {
        return;
    }

    stack.blocks.push({
        id: `animal-debug:${animalDebugStorageVersion}:${name}:${x}:${z}`,
        name,
        rotation,
    });
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

function createAllAnimalStacks() {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, 0, 'CatPillow');
    placeBlock(stacks, -5, 2, 'DogHouse');
    placeBlock(stacks, 2, 0, 'Tree');
    placeBlock(stacks, 3, -2, 'Stool');
    placeBlock(stacks, 3, 2, 'Bucket');
    placeBlock(stacks, -4, 3, 'StoneMedium');
    for (let z = -4; z <= 1; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
    }

    placeBlock(stacks, -5, -3, 'BirdHouse');
    placeBlock(stacks, 2, 2, 'Bush');
    placeBlock(stacks, 3, 3, 'WaterWell');
    placeBlock(stacks, -2, -2, 'Tulip');
    placeBlock(stacks, 1, -3, 'Tulip');
    placeBlock(stacks, 5, -3, 'Tulip');
    placeBlock(stacks, -3, 2, 'CactusPricklyPear');
    placeBlock(stacks, 2, -1, 'CactusBarrel');

    return serializeStacks(stacks);
}

function persistAnimalDebugStacks(
    storageKey: string,
    stacks: StoredSandboxStack[],
) {
    window.localStorage.setItem(storageKey, JSON.stringify({ stacks }));
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
                    persistAnimalDebugStacks(
                        storageKey,
                        createAllAnimalStacks(),
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
