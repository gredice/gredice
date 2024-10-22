'use client';

import {
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { Vector3, PCFSoftShadowMap } from 'three';
import { Canvas } from '@react-three/fiber';
import { MeshWobbleMaterial, OrbitControls, StatsGl, useGLTF } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import { HTMLAttributes, useEffect, useMemo } from 'react';
import { Environment } from './Environment';
import { makeButton, makeFolder, useTweaks } from 'use-tweaks';
import { useGameState } from './useGameState';
import type { Stack } from './types/Stack';
import type { Block } from './types/Block';
import type { Garden } from './types/Garden';
import { RecursivePartial } from '@signalco/js';
import { RotatableGroup } from './controls/RotatableGroup';
import { PickableGroup } from './controls/PickableGroup';
import { EntityInstanceProps } from './types/runtime/EntityInstanceProps';
import { getStack } from './utils/getStack';
import { entities } from './data/entities';
import { stackHeight } from './utils/getStackHeight';

const models = {
    GameAssets: { url: '/assets/models/GameAssets.glb' }
}

const entityNameMap = {
    [entities.BlockGround.name]: BlockGround,
    [entities.BlockGrass.name]: BlockGrass,
    [entities.RaisedBed.name]: RaisedBed,
    [entities.Shade.name]: Shade
}

function EntityFactory({ name, stack, block, ...rest }: { name: string } & EntityInstanceProps) {
    const EntityComponent = entityNameMap[name];
    if (!EntityComponent) {
        return null;
    }

    const moveBlock = useGameState(state => state.moveBlock);
    const handlePositionChanged = (movement: Vector3) => {
        const dest = stack.position.clone().add(movement);
        const blockIndex = stack.blocks.indexOf(block);
        moveBlock(stack.position, blockIndex, dest);
    }

    return (
        <PickableGroup
            stack={stack}
            block={block}
            onPositionChanged={handlePositionChanged}>
            <EntityComponent
                stack={stack}
                block={block}
                {...rest} />
        </PickableGroup>
    );
}

function useAnimatedEntityRotation(rotation: number) {
    const [springs, api] = useSpring(() => ({
        from: { rotation: [0, rotation * (Math.PI / 2), 0] },
        config: {
            mass: 0.1,
            tension: 200,
            friction: 10
        }
    }));

    useEffect(() => {
        api.start({ rotation: [0, rotation * (Math.PI / 2), 0] });
    }, [rotation]);

    return useMemo(() => [springs.rotation], [springs.rotation]);
}

function useGameGLTF(url: string) {
    const appBaseUrl = useGameState(state => state.appBaseUrl);
    return useGLTF(appBaseUrl + url);
}

export function Shade({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);

    let variant = "Solo";
    let realizedRotation = rotation % 2;
    const neighbors = getEntityNeighbors(stack, block);
    const nInline = neighbors.n && realizedRotation === 0 && (neighbors.nr % 2) === 0;
    const eInline = neighbors.e && realizedRotation === 1 && (neighbors.er % 2) === 1;
    const wInline = neighbors.w && realizedRotation === 1 && (neighbors.wr % 2) === 1;
    const sInline = neighbors.s && realizedRotation === 0 && (neighbors.sr % 2) === 0;
    if (neighbors.total >= 2 && ((nInline && sInline) || (eInline && wInline))) {
        variant = "Middle";
    } else if (nInline || eInline) {
        variant = "End_Left";
    } else if (wInline || sInline) {
        variant = "End_Right";
    }

    const [animatedRotation] = useAnimatedEntityRotation(realizedRotation);

    return (
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block) + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Shade_${variant}`].geometry}
                material={materials['Material.Planks']}
            />
        </animated.group>
    );
}

export function BlockGrass({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    const variantResolved = 1;

    return (
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block) + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Grass_1_1.geometry}
            >
                {/* // TODO: Apply environment wind to wobble animation */}
                <MeshWobbleMaterial {...materials['Material.GrassPart']} factor={0.01} speed={4} />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Grass_${variantResolved}_2`].geometry}
                material={materials[`Material.Grass`]}
            />
        </animated.group>
    );
}

export function BlockGround({ stack, block, rotation, variant }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    const variantResolved = (variant ?? 1) % 2;

    return (
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block) + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Ground_${variantResolved}_1`].geometry}
                material={nodes[`Block_Ground_${variantResolved}_1`].material}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Ground_${variantResolved}_2`].geometry}
                material={materials['Material.Stone']}
            />
        </animated.group>
    );
}

function getEntityNeighbors(stack: Stack, block: Block) {
    const currentInStackIndex = stack.blocks.indexOf(block);
    const neighbors = {
        w: getStack({ x: stack.position.x, z: stack.position.z + 1 })?.blocks.at(currentInStackIndex)?.name === block.name,
        wr: getStack({ x: stack.position.x, z: stack.position.z + 1 })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        n: getStack({ x: stack.position.x + 1, z: stack.position.z })?.blocks.at(currentInStackIndex)?.name === block.name,
        nr: getStack({ x: stack.position.x + 1, z: stack.position.z })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        e: getStack({ x: stack.position.x, z: stack.position.z - 1 })?.blocks.at(currentInStackIndex)?.name === block.name,
        er: getStack({ x: stack.position.x, z: stack.position.z - 1 })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        s: getStack({ x: stack.position.x - 1, z: stack.position.z })?.blocks.at(currentInStackIndex)?.name === block.name,
        sr: getStack({ x: stack.position.x - 1, z: stack.position.z })?.blocks.at(currentInStackIndex)?.rotation ?? 0
    };
    return {
        total: (neighbors.w ? 1 : 0) + (neighbors.n ? 1 : 0) + (neighbors.e ? 1 : 0) + (neighbors.s ? 1 : 0),
        ...neighbors
    };
}

export function RaisedBed({ stack, block }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url)

    // Switch between shapes (O, L, I, U) based on neighbors
    let shape = "O";
    let shapeRotation = 0;
    const neighbors = getEntityNeighbors(stack, block);
    if (neighbors.total === 1) {
        shape = "U";

        if (neighbors.n) {
            shapeRotation = 0;
        } else if (neighbors.e) {
            shapeRotation = 1;
        } else if (neighbors.s) {
            shapeRotation = 2;
        } else if (neighbors.w) {
            shapeRotation = 3;
        }
    } else if (neighbors.total === 2) {
        if ((neighbors.n && neighbors.s) ||
            (neighbors.e && neighbors.w)) {
            shape = "I";

            if (neighbors.n && neighbors.s) {
                shapeRotation = 1;
            } else {
                shapeRotation = 0;
            }
        } else {
            shape = "L";

            if (neighbors.n && neighbors.e) {
                shapeRotation = 0;
            } else if (neighbors.e && neighbors.s) {
                shapeRotation = 1;
            } else if (neighbors.s && neighbors.w) {
                shapeRotation = 2;
            } else {
                shapeRotation = 3;
            }
        }
    } else if (neighbors.total === 3) {
        shape = "O"
    }

    return (
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block) + 1)}
            rotation={[0, shapeRotation * (Math.PI / 2), 0]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Raised_Bed_${shape}_2`].geometry}
                material={materials['Material.Planks']}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Raised_Bed_${shape}_1`].geometry}
                material={materials['Material.Dirt']}
            />
        </animated.group>
    );
}

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

    // Set app base URL
    const setAppBaseUrl = useGameState((state) => state.setAppBaseUrl);
    useEffect(() => {
        setAppBaseUrl(appBaseUrl ?? '');

        useGLTF.preload(appBaseUrl + models.GameAssets.url);
    }, [appBaseUrl]);

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
        <Canvas
            orthographic
            shadows={{
                type: PCFSoftShadowMap,
                enabled: true,
            }}
            camera={{
                position: cameraPosition,
                zoom: zoom === 'far' ? 75 : 100,
                far: 10000,
                near: 0.01
            }}
            {...rest}>

            {isDevelopment && <DebugHud />}

            <GardenDisplay noBackground={noBackground} />

            <OrbitControls
                enableRotate={false}
                minZoom={50}
                maxZoom={200} />
        </Canvas>
    );
}