'use client';

import { Vector3 } from 'three';
import { OrbitControls } from '@react-three/drei';
import { HTMLAttributes, useEffect } from 'react';
import { Environment } from './scene/Environment';
import { useGameState } from './useGameState';
import type { Stack } from './types/Stack';
import type { Garden } from './types/Garden';
import { RotatableGroup } from './controls/RotatableGroup';
import { Scene } from './scene/Scene';
import { EntityFactory } from './entities/EntityFactory';
import { DayNightCycleHud } from './hud/DayNightCycleHud';
import { DebugHud } from './hud/DebugHud';

// function serializeGarden(garden: Garden) {
//     return JSON.stringify(garden);
// }

// function deserializeGarden(serializedGarden: string): Garden {
//     const garden = JSON.parse(serializedGarden) as RecursivePartial<Garden>;

//     if (!garden.name) {
//         garden.name = getDefaultGarden().name;
//     }
//     if (!garden.location || !garden.location.lat || !garden.location.lon) {
//         garden.location = getDefaultGarden().location;
//     }

//     // Deserialize stacks
//     garden.stacks = garden.stacks?.map(stack => {
//         stack.position = new Vector3(stack.position?.x, stack.position?.y, stack.position?.z);
//         return stack;
//     });

//     return garden as Garden;
// }

function getDefaultGarden(): Garden {
    const size = 1;
    const stacks: Stack[] = [];
    for (let x = -size; x <= size + 1; x++) {
        for (let z = -size; z <= size; z++) {
            stacks.push({
                position: new Vector3(x, 0, z),
                blocks: [
                    { name: "Block_Grass", rotation: Math.floor(Math.random() * 4) },
                ]
            });
        }
    }
    stacks.find(stack => stack.position.x === 0 && stack.position.z === 0)?.blocks.push({ name: "Raised_Bed", rotation: 0 });
    stacks.find(stack => stack.position.x === 1 && stack.position.z === 0)?.blocks.push({ name: "Raised_Bed", rotation: 0 });

    return {
        name: 'Moj vrt',
        stacks,
        location: {
            lat: 45.739,
            lon: 16.572
        }
    };
}

// TODO: Use to deserialize
// async function getGarden() {
//     const serializedGarden = localStorage.getItem(gardenLocalStorageKey);
//     if (serializedGarden) {
//         return deserializeGarden(serializedGarden);
//     } else {
//         const newGarden = deserializeGarden(serializeGarden(getDefaultGarden()));
//         localStorage.setItem(gardenLocalStorageKey, serializeGarden(newGarden));
//         return newGarden;
//     }
// }

export function GardenDisplay({ noBackground }: { noBackground?: boolean }) {
    const stacks = useGameState(state => state.stacks);
    const setStacks = useGameState(state => state.setStacks);

    // Load garden from remote
    const garden = getDefaultGarden();
    const isLoadingGarden = false;
    useEffect(() => {
        // Only update local state if we don't have any local state (first load or no stacks)
        if (garden && !isLoadingGarden && stacks.length <= 0) {
            setStacks(garden.stacks);
        }

        // TODO: Check if we are ou-of-sync with remote state and
        //       present user with "Reload" button (notification)
    }, [garden, isLoadingGarden]);

    // TODO: Update garden remote state when local stage changes

    if (!garden) {
        return null;
    }

    return (
        <>
            <Environment noBackground={noBackground} location={garden.location} />
            <group>
                {stacks.map((stack) =>
                    stack.blocks?.map((block, i) => {
                        return (
                            <RotatableGroup
                                key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.name}-${i}`}
                                stack={stack}
                                block={block}>
                                <EntityFactory
                                    name={block.name}
                                    stack={stack}
                                    block={block}
                                    rotation={block.rotation}
                                    variant={block.variant} />
                            </RotatableGroup>
                        );
                    })
                )}
            </group>
        </>
    )
}

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string,
    isDevelopment?: boolean,
    zoom?: 'far' | 'normal',
    freezeTime?: Date,
    noBackground?: boolean,
    hideHud?: boolean
}

export function GameScene({
    appBaseUrl,
    isDevelopment,
    zoom = 'normal',
    freezeTime,
    noBackground,
    hideHud,
    ...rest
}: GameSceneProps) {
    const cameraPosition = 100;

    // Update current time every second
    const setCurrentTime = useGameState((state) => state.setCurrentTime);
    useEffect(() => {
        setCurrentTime(freezeTime ?? new Date());
        const interval = setInterval(() => {
            setCurrentTime(useGameState.getState().freezeTime ?? new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div {...rest}>
            <Scene
                appBaseUrl={appBaseUrl}
                freezeTime={freezeTime}
                position={cameraPosition}
                zoom={zoom === 'far' ? 75 : 100}
                className='!absolute'
            >
                {isDevelopment && <DebugHud />}
                <GardenDisplay noBackground={noBackground} />
                <OrbitControls
                    enableRotate={false}
                    minZoom={50}
                    maxZoom={200} />
            </Scene>
            {!hideHud && (
                <DayNightCycleHud lat={45.739} lon={16.572} currentTime={useGameState((state) => state.currentTime)} />
            )}
        </div>
    );
}