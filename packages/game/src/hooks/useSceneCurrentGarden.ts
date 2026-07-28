import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { GardenStack, Stack } from '../types/Stack';
import type { CurrentGarden } from './useCurrentGarden';

export type SceneCurrentGarden = Omit<CurrentGarden, 'stacks'> & {
    stacks: Stack[];
};

type SceneCurrentGardenAdapter = (
    garden: CurrentGarden | null | undefined,
) => SceneCurrentGarden | null | undefined;

function sceneStackMatchesGardenStack(
    sceneStack: Stack,
    gardenStack: GardenStack,
) {
    return (
        sceneStack.blocks === gardenStack.blocks &&
        sceneStack.position.x === gardenStack.position.x &&
        sceneStack.position.y === gardenStack.position.y &&
        sceneStack.position.z === gardenStack.position.z
    );
}

export function createSceneCurrentGardenAdapter(): SceneCurrentGardenAdapter {
    const sceneStackByGardenStack = new WeakMap<GardenStack, Stack>();

    return (garden) => {
        if (!garden) {
            return garden;
        }

        const stacks = garden.stacks.map((gardenStack) => {
            const cachedSceneStack = sceneStackByGardenStack.get(gardenStack);
            if (
                cachedSceneStack &&
                sceneStackMatchesGardenStack(cachedSceneStack, gardenStack)
            ) {
                return cachedSceneStack;
            }

            const sceneStack: Stack = {
                blocks: gardenStack.blocks,
                position: new Vector3(
                    gardenStack.position.x,
                    gardenStack.position.y,
                    gardenStack.position.z,
                ),
            };
            sceneStackByGardenStack.set(gardenStack, sceneStack);
            return sceneStack;
        });

        return {
            ...garden,
            stacks,
        };
    };
}

export function useSceneCurrentGarden(
    garden: CurrentGarden | null | undefined,
) {
    const adapterRef = useRef<SceneCurrentGardenAdapter | null>(null);
    if (!adapterRef.current) {
        adapterRef.current = createSceneCurrentGardenAdapter();
    }
    const adapter = adapterRef.current;

    return useMemo(() => adapter(garden), [adapter, garden]);
}
