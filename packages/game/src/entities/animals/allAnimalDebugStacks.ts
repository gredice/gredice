import { createGardenPosition, type GardenStack } from '../../types/Stack';

type AnimalDebugBounds = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

const animalDebugStorageVersion = 1;

function stackKey(x: number, z: number) {
    return `${x}:${z}`;
}

function createGroundStacks(bounds: AnimalDebugBounds) {
    const stacks = new Map<string, GardenStack>();

    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
            stacks.set(stackKey(x, z), {
                position: createGardenPosition(x, 0, z),
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
    stacks: Map<string, GardenStack>,
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
    stacks: Map<string, GardenStack>,
    x: number,
    z: number,
    name: 'Block_Dry_Ground',
) {
    const ground = stacks.get(stackKey(x, z))?.blocks[0];
    if (ground) {
        ground.name = name;
    }
}

function serializeStacks(stacks: Map<string, GardenStack>) {
    return Array.from(stacks.values()).sort((left, right) => {
        if (left.position.x !== right.position.x) {
            return left.position.x - right.position.x;
        }

        return left.position.z - right.position.z;
    });
}

export function createAllAnimalDebugStacks(): GardenStack[] {
    const stacks = createGroundStacks({
        minX: -6,
        maxX: 6,
        minZ: -4,
        maxZ: 4,
    });

    placeBlock(stacks, -5, 0, 'CatPillow');
    placeBlock(stacks, -5, 2, 'DogHouse');
    placeBlock(stacks, -5, -2, 'ChickenCoop');
    placeBlock(stacks, -6, 1, 'PigletPen');
    placeBlock(stacks, -6, -1, 'CowShelter', 2, 0);
    placeBlock(stacks, 3, 2, 'CowShelter', 2, 1);
    placeBlock(stacks, -4, 2, 'SheepFold');
    placeBlock(stacks, 1, -3, 'SheepFold');
    placeBlock(stacks, -1, 3, 'GoatShelter', 1);
    placeBlock(stacks, -2, -3, 'RabbitHutch', 0, 0);
    placeBlock(stacks, 2, -1, 'HorseStable', 0, 0);
    placeBlock(stacks, 5, 0, 'Tree');
    placeBlock(stacks, 5, 1, 'Pine');
    placeBlock(stacks, 3, -2, 'Stool');
    placeBlock(stacks, 5, 2, 'Bucket');
    placeBlock(stacks, -6, 3, 'StoneMedium');
    for (let z = -4; z <= 1; z += 1) {
        placeBlock(stacks, 0, z, z % 2 === 0 ? 'GardenBox' : 'Composter');
    }

    placeBlock(stacks, -5, -3, 'BirdHouse');
    placeBlock(stacks, 2, 2, 'Bush');
    placeBlock(stacks, 3, 3, 'WaterWell');
    placeBlock(stacks, -2, -2, 'Tulip');
    placeBlock(stacks, 0, -3, 'Tulip');
    placeBlock(stacks, 5, -3, 'Tulip');
    placeBlock(stacks, -6, 2, 'CactusPricklyPear');
    placeBlock(stacks, 5, -1, 'CactusBarrel');
    replaceGround(stacks, 4, -1, 'Block_Dry_Ground');

    return serializeStacks(stacks);
}
