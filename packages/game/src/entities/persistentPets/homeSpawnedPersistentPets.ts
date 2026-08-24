import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';

export const homeSpawnedPersistentPetNames = [
    'CowShelter',
    'HorseStable',
    'RabbitHutch',
] as const;

export type HomeSpawnedPersistentPetName =
    (typeof homeSpawnedPersistentPetNames)[number];

function isHomeSpawnedPersistentPetName(
    name: string,
): name is HomeSpawnedPersistentPetName {
    return homeSpawnedPersistentPetNames.some(
        (candidate) => candidate === name,
    );
}

export type HomeSpawnedPersistentPetInstance = {
    block: Block;
    name: HomeSpawnedPersistentPetName;
    stack: Stack;
};

export function getHomeSpawnedPersistentPetInstances(
    stacks: Stack[] | undefined,
) {
    return (stacks ?? []).flatMap((stack) =>
        stack.blocks.flatMap((block) =>
            isHomeSpawnedPersistentPetName(block.name)
                ? [{ block, name: block.name, stack }]
                : [],
        ),
    ) satisfies HomeSpawnedPersistentPetInstance[];
}
