'use client';

import {
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { Vector3 } from 'three';
import { OrbitControls, StatsGl, useGLTF } from '@react-three/drei';
import { HTMLAttributes, useEffect } from 'react';
import { Environment } from './scene/Environment';
import { makeButton, makeFolder, useTweaks } from 'use-tweaks';
import { useGameState } from './useGameState';
import type { Stack } from './types/Stack';
import type { Garden } from './types/Garden';
import { RecursivePartial } from '@signalco/js';
import { RotatableGroup } from './controls/RotatableGroup';
import { getStack } from './utils/getStack';
import { entities } from './data/entities';
import { Scene } from './scene/Scene';
import { EntityFactory } from './entities/EntityFactory';
import { models } from './data/models';

function serializeGarden(garden: Garden) {
    return JSON.stringify(garden);
}

function deserializeGarden(serializedGarden: string): Garden {
    const garden = JSON.parse(serializedGarden) as RecursivePartial<Garden>;

    if (!garden.name) {
        garden.name = getDefaultGarden().name;
    }
    if (!garden.location || !garden.location.lat || !garden.location.lon) {
        garden.location = getDefaultGarden().location;
    }

    // Deserialize stacks
    garden.stacks = garden.stacks?.map(stack => {
        stack.position = new Vector3(stack.position?.x, stack.position?.y, stack.position?.z);
        return stack;
    });

    return garden as Garden;
}

function getDefaultGarden(): Garden {
    const size = 1;
    const stacks: Stack[] = [];
    for (let x = -size; x <= size + 1; x++) {
        for (let z = -size; z <= size; z++) {
            stacks.push({
                position: new Vector3(x, 0, z),
                blocks: [
                    { name: entities.BlockGrass.name, rotation: Math.floor(Math.random() * 4) },
                ]
            });
        }
    }
    stacks.find(stack => stack.position.x === 0 && stack.position.z === 0)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });
    stacks.find(stack => stack.position.x === 1 && stack.position.z === 0)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });

    return {
        name: 'Moj vrt',
        stacks,
        location: {
            lat: 45.739,
            lon: 16.572
        }
    };
}

const gardenLocalStorageKey = 'garden';
function gardenQueryKey() {
    return ['garden'];
}

async function getGarden() {
    const serializedGarden = localStorage.getItem(gardenLocalStorageKey);
    if (serializedGarden) {
        return deserializeGarden(serializedGarden);
    } else {
        const newGarden = deserializeGarden(serializeGarden(getDefaultGarden()));
        localStorage.setItem(gardenLocalStorageKey, serializeGarden(newGarden));
        return newGarden;
    }
}

function useGarden() {
    return useQuery({
        queryKey: ['garden'],
        queryFn: getGarden,
        staleTime: 0
    })
}

function useUpdateGarden() {
    const queryClient = useQueryClient();
    return async ({ stacks }: { stacks?: Stack[] }) => {
        const garden = await getGarden();
        if (stacks) {
            garden.stacks = structuredClone(stacks);

            // Garden cleanup
            // - remove empty stacks
            garden.stacks = garden.stacks.filter(stack => stack.blocks.length > 0);
        }

        localStorage.setItem(gardenLocalStorageKey, serializeGarden(garden));
        queryClient.invalidateQueries({ queryKey: gardenQueryKey() });
    }
}

export function GardenDisplay({ noBackground }: { noBackground?: boolean }) {
    const stacks = useGameState(state => state.stacks);
    const setStacks = useGameState(state => state.setStacks);

    // Load garden from remote
    const { data: garden, isLoading: isLoadingGarden } = useGarden();
    useEffect(() => {
        // Only update local state if we don't have any local state (first load or no stacks)
        if (garden && !isLoadingGarden && stacks.length <= 0) {
            setStacks(garden.stacks);
        }

        // TODO: Check if we are ou-of-sync with remote state and
        //       present user with "Reload" button (notification)
    }, [garden, isLoadingGarden]);

    // Update garden remote state when local stage changes
    const updateGarden = useUpdateGarden();
    useEffect(() => {
        if (!isLoadingGarden)
            updateGarden({ stacks });
    }, [stacks]);

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

function DebugHud() {
    const placeBlock = useGameState(state => state.placeBlock);
    const handlePlaceBlock = (name: string) => {
        let x = 0, z = 0;
        // Search for empty stack in watter flow pattern
        // place block in first empty stack
        while (true) {
            const stack = getStack({ x, z });
            if (!stack || stack.blocks.length === 0) {
                break;
            }
            x++;
            if (x > z + 1) {
                x = 0;
                z++;
            }
        }

        placeBlock(new Vector3(x, 0, z), { name, rotation: 0 });
    };

    useTweaks('Entities', {
        ...makeFolder("Blocks", {
            ...makeButton('Grass', () => handlePlaceBlock(entities.BlockGrass.name)),
            ...makeButton('Ground', () => handlePlaceBlock(entities.BlockGround.name)),
        }),
        ...makeFolder("Structures", {
            ...makeButton('Raised Bed', () => handlePlaceBlock(entities.RaisedBed.name)),
            ...makeButton('Shade', () => handlePlaceBlock(entities.Shade.name)),
        }),
    });

    const currentTime = useGameState((state) => state.currentTime);
    const setCurrentTime = useGameState((state) => state.setCurrentTime);
    const { timeOfDay } = useTweaks('Environment', {
        timeOfDay: { value: (currentTime.getHours() * 60 * 60 + currentTime.getMinutes() * 60 + currentTime.getSeconds()) / (24 * 60 * 60), min: 0, max: 1 },
    });

    useEffect(() => {
        const date = new Date();
        const seconds = timeOfDay * 24 * 60 * 60;
        date.setHours(seconds / 60 / 60);
        date.setMinutes((seconds / 60) % 60);
        date.setSeconds(seconds % 60);
        setCurrentTime(date);
    }, [timeOfDay]);

    return (
        <>
            {/* <gridHelper args={[100, 100, '#B8B4A3', '#CFCBB7']} position={[0.5, 0, 0.5]} /> */}
            <StatsGl className='absolute top-0 left-0' />
        </>
    );
}

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string,
    isDevelopment?: boolean,
    zoom?: 'far' | 'normal',
    freezeTime?: Date,
    noBackground?: boolean
}

export function GameScene({
    appBaseUrl,
    isDevelopment,
    zoom = 'normal',
    freezeTime,
    noBackground,
    ...rest
}: GameSceneProps) {
    const cameraPosition = 100;

    // Update current time every second
    const setCurrentTime = useGameState((state) => state.setCurrentTime);
    useEffect(() => {
        if (freezeTime) {
            setCurrentTime(freezeTime);
            return;
        }

        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Scene
            appBaseUrl={appBaseUrl}
            position={cameraPosition}
            zoom={zoom === 'far' ? 75 : 100}
            {...rest}
        >
            {isDevelopment && <DebugHud />}
            <GardenDisplay noBackground={noBackground} />
            <OrbitControls
                enableRotate={false}
                minZoom={50}
                maxZoom={200} />
        </Scene>
    );
}