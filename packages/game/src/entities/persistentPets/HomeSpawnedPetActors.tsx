import { useMemo } from 'react';
import type { Stack } from '../../types/Stack';
import { Cow } from '../Cow';
import { Horse } from '../horses/Horse';
import { Rabbit } from '../rabbits/Rabbit';
import { getHomeSpawnedPersistentPetInstances } from './homeSpawnedPersistentPets';

const homeSpawnedPetComponents = {
    CowShelter: Cow,
    HorseStable: Horse,
    RabbitHutch: Rabbit,
} as const;

export function HomeSpawnedPersistentPets({
    stacks,
}: {
    stacks: Stack[] | undefined;
}) {
    const pets = useMemo(
        () => getHomeSpawnedPersistentPetInstances(stacks),
        [stacks],
    );

    return pets.map(({ block, name, stack }) => {
        const Pet = homeSpawnedPetComponents[name];
        return (
            <Pet
                key={`${block.name}:${block.id}`}
                block={block}
                rotation={block.rotation}
                stack={stack}
                stacks={stacks}
                variant={block.variant}
            />
        );
    });
}
