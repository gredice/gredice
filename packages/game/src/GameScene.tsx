'use client';

import {
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { Vector3, Plane, Raycaster, Vector2, PCFSoftShadowMap } from 'three';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { MeshWobbleMaterial, OrbitControls, StatsGl, useGLTF } from '@react-three/drei';
import { HTMLAttributes, PointerEvent, PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { Handler, useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';
import { Environment } from './Environment';
import { makeButton, makeFolder, useTweaks } from 'use-tweaks';
import { useGameState } from './useGameState';
import type { Stack } from './types/Stack';
import type { Block } from './types/Block';
import type { Garden } from './types/Garden';
import { RecursivePartial } from '@signalco/js';
import { cx } from '@signalco/ui-primitives/cx';

const models = {
    GameAssets: { url: '/assets/models/GameAssets.glb' }
}

type Entity = {
    name: string,
    height?: number,
    stackable?: boolean
}

const entities = {
    BlockGround: {
        name: 'Block_Ground',
        height: 0.4,
        stackable: true
    },
    BlockGrass: {
        name: 'Block_Grass',
        height: 0.4,
        stackable: true
    },
    RaisedBed: {
        name: 'Raised_Bed',
        height: 0.3
    },
    Shade: {
        name: 'Shade',
        height: 1
    }
} satisfies Record<string, Entity>;

function getEntityByName(name: string) {
    return Object.values(entities).find(entity => entity.name === name);
}

function stackHeight(stack: Stack | undefined, stopBlock?: Block) {
    if (!stack || stack.blocks.length <= 0) {
        return 0;
    }

    let height = 0;
    for (const block of stack.blocks) {
        if (block === stopBlock) {
            return height;
        }
        height += getEntityByName(block.name)?.height ?? 0;
    }
    return height
}

export function getStack(stacks: Stack[], { x, z }: Vector3 | { x: number, z: number }) {
    return stacks.find(stack => stack.position.x === x && stack.position.z === z);
}

type EntityProps = {
    stack: Stack,
    block: Block,
    position: Vector3,
    rotation: number
    variant?: number
}

const entityNameMap = {
    [entities.BlockGround.name]: BlockGround,
    [entities.BlockGrass.name]: BlockGrass,
    [entities.RaisedBed.name]: RaisedBed,
    [entities.Shade.name]: Shade
}

function EntityFactory({ name, stack, block, position, ...rest }: { name: string } & EntityProps) {
    const EntityComponent = entityNameMap[name];
    if (!EntityComponent) {
        return null;
    }

    const moveBlock = useGameState(state => state.moveBlock);
    const handlePositionChanged = (movement: Vector3) => {
        const dest = position.clone().add(movement);
        const blockIndex = stack.blocks.indexOf(block);
        moveBlock(stack.position, blockIndex, dest);
    }

    return (
        <Pickup
            stack={stack}
            block={block}
            position={position}
            onPositionChanged={handlePositionChanged}>
            <EntityComponent
                stack={stack}
                block={block}
                position={position}
                {...rest} />
        </Pickup>
    );
}

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

type PickupProps = PropsWithChildren<
    Pick<EntityProps, 'position' | 'stack' | 'block'> &
    { onPositionChanged: (movement: Vector3) => void }>;

function Pickup({ children, stack, block, position, onPositionChanged }: PickupProps) {
    const stacks = useGameState(state => state.stacks);

    const [springs, api] = useSpring(() => ({
        from: { internalPosition: [0, 0, 0] },
        config: {
            mass: 0.1,
            tension: 200,
            friction: 10
        }
    }));

    // Reset position animation when block is moved
    useEffect(() => {
        api.set({ internalPosition: [0, 0, 0] });
    }, [position]);

    const camera = useThree(state => state.camera);
    const domElement = useThree(state => state.gl.domElement);
    // TODO: Use observed DOM element client rect (hook from @signalco/hooks when available)
    const rect = useMemo(() => domElement.getClientRects()[0], [domElement]);
    const dragState = useMemo(() => ({
        pt: new Vector3(),
        dest: new Vector3(),
        relative: new Vector3()
    }), []);
    const currentStackHeight = useMemo(() => stackHeight(stack, block), [stack, block]);
    const didDrag = useRef(false);

    const dragHandler: Handler<"drag", any> = ({ pressed, event, xy: [x, y] }) => {
        event.stopPropagation();
        const { pt, dest, relative } = dragState;
        pt.set(
            ((x - rect.left) / rect.width) * 2 - 1,
            ((rect.top - y) / rect.height) * 2 + 1,
            0
        );

        const raycaster = new Raycaster()
        raycaster.setFromCamera(new Vector2(pt.x, pt.y), camera)
        const isIntersecting = raycaster.ray.intersectPlane(groundPlane, pt);
        if (!isIntersecting) {
            return;
        }

        dest.set(pt.x, 0, pt.z).ceil();
        relative.set(dest.x - position.x, 0, dest.z - position.z);

        const hoveredStack = getStack(stacks, dest);
        const hoveredStackHeight = hoveredStack === stack
            ? 0
            : stackHeight(hoveredStack) - currentStackHeight;

        if (!pressed) {
            if (!didDrag.current) {
                return;
            }
            didDrag.current = false;
            api.start({ internalPosition: [relative.x, hoveredStackHeight, relative.z] })[0].then(() => {
                onPositionChanged(relative);
            });
        } else {
            didDrag.current = true;
            api.start({ internalPosition: [relative.x, hoveredStackHeight + 0.1, relative.z] });
        }
    };

    const bind = useDrag(dragHandler, {
        filterTaps: true
    });

    function customBind() {
        const bindProps = bind();
        return {
            ...bindProps,
            onPointerDown: (event: PointerEvent) => {
                event.stopPropagation();
                bindProps.onPointerDown?.(event);
            }
        };
    }

    return (
        <animated.group
            position={springs.internalPosition as unknown as [number, number, number]}
            {...customBind() as any}>
            {children}
        </animated.group>
    )
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

export function Shade({ stack, block, position, rotation }: EntityProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);

    let variant = "Solo";
    let realizedRotation = rotation % 2;
    const neighbors = getEntityNeighbors(stack, block, position);
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
            position={position.clone().setY(stackHeight(stack, block) + 1)}
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

export function BlockGrass({ stack, block, position, rotation }: EntityProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    const variantResolved = 1;

    return (
        <animated.group
            position={position.clone().setY(stackHeight(stack, block) + 0.2)}
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

export function BlockGround({ stack, block, position, rotation, variant }: EntityProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    const variantResolved = (variant ?? 1) % 2;

    return (
        <animated.group
            position={position.clone().setY(stackHeight(stack, block) + 1)}
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

function getEntityNeighbors(stack: Stack, block: Block, position: Vector3) {
    const stacks = useGameState(state => state.stacks);
    const currentInStackIndex = stack.blocks.indexOf(block);
    const neighbors = {
        w: getStack(stacks, { x: position.x, z: position.z + 1 })?.blocks.at(currentInStackIndex)?.name === block.name,
        wr: getStack(stacks, { x: position.x, z: position.z + 1 })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        n: getStack(stacks, { x: position.x + 1, z: position.z })?.blocks.at(currentInStackIndex)?.name === block.name,
        nr: getStack(stacks, { x: position.x + 1, z: position.z })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        e: getStack(stacks, { x: position.x, z: position.z - 1 })?.blocks.at(currentInStackIndex)?.name === block.name,
        er: getStack(stacks, { x: position.x, z: position.z - 1 })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        s: getStack(stacks, { x: position.x - 1, z: position.z })?.blocks.at(currentInStackIndex)?.name === block.name,
        sr: getStack(stacks, { x: position.x - 1, z: position.z })?.blocks.at(currentInStackIndex)?.rotation ?? 0
    };
    return {
        total: (neighbors.w ? 1 : 0) + (neighbors.n ? 1 : 0) + (neighbors.e ? 1 : 0) + (neighbors.s ? 1 : 0),
        ...neighbors
    };
}

export function RaisedBed({ stack, block, position }: EntityProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url)

    // Switch between shapes (O, L, I, U) based on neighbors
    let shape = "O";
    let shapeRotation = 0;
    const neighbors = getEntityNeighbors(stack, block, position);
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
            position={position.clone().setY(stackHeight(stack, block) + 1)}
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
    const rotateBlock = useGameState(state => state.rotateBlock);

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

    const handleContextMenu = (stack: Stack, block: Block, blockIndex: number, event: ThreeEvent<MouseEvent>) => {
        event.nativeEvent.preventDefault()
        event.stopPropagation();
        rotateBlock(stack.position, blockIndex, block.rotation + 1);
    }

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
                            <group
                                key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.name}-${i}`}
                                onContextMenu={(event) => handleContextMenu(stack, block, i, event)}>
                                <EntityFactory
                                    name={block.name}
                                    stack={stack}
                                    block={block}
                                    position={new Vector3(stack.position.x, 0, stack.position.z)}
                                    rotation={block.rotation}
                                    variant={block.variant} />
                            </group>
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
        const stacks = useGameState.getState().stacks;
        // Search for empty stack in watter flow pattern
        // place block in first empty stack
        while (true) {
            const stack = getStack(stacks, { x, z });
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