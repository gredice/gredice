'use client';

import {
    useQuery,
    QueryClient,
    QueryClientProvider,
    useQueryClient,
} from '@tanstack/react-query';
import * as THREE from 'three';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { MeshWobbleMaterial, OrbitControls, StatsGl, useCamera, useGLTF } from '@react-three/drei';
import { PointerEvent, PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { Handler, useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';
import { create } from 'zustand';

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
};

function getEntityByName(name: string) {
    return Object.values(entities).find(entity => entity.name === name);
}

function stackHeight(stack: Stack | undefined, stopBlock?: Block) {
    let height = 0;
    if (!stack) {
        return height;
    }

    for (const block of stack.blocks) {
        if (block === stopBlock) {
            return height;
        }
        height += getEntityByName(block.name)?.height ?? 0;
    }
    return height
}

function getStack(stacks: Stack[], { x, z }: THREE.Vector3 | { x: number, z: number }) {
    return stacks.find(stack => stack.position.x === x && stack.position.z === z);
}

type EntityProps = {
    stack: Stack,
    block: Block,
    position: THREE.Vector3,
    rotation: number
    variant?: number
}

const entityNameMap = {
    [entities.BlockGround.name]: BlockGround,
    [entities.BlockGrass.name]: BlockGrass,
    [entities.RaisedBed.name]: RaisedBed,
    [entities.Shade.name]: BlockShade
}

function EntityFactory({ name, stack, block, position, ...rest }: { name: string } & EntityProps) {
    const EntityComponent = entityNameMap[name];
    if (!EntityComponent) {
        return null;
    }

    const moveBlock = useGameState(state => state.moveBlock);
    const handlePositionChanged = (movement: THREE.Vector3) => {
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

useGLTF.preload(models.GameAssets.url);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

type PickupProps = PropsWithChildren<
    Pick<EntityProps, 'position' | 'stack' | 'block'> &
    { onPositionChanged: (movement: THREE.Vector3) => void }>;

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
        pt: new THREE.Vector3(),
        dest: new THREE.Vector3(),
        relative: new THREE.Vector3()
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

        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(pt.x, pt.y), camera)
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

    const customBind = () => {
        const bindProps = bind();
        return {
            ...bindProps,
            onPointerDown: (event: PointerEvent) => {
                event.stopPropagation();
                bindProps.onPointerDown?.(event);
            }
        };
    };

    return (
        <animated.group
            position={springs.internalPosition}
            {...customBind()}>
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

export function BlockShade({ stack, block, position, rotation }: EntityProps) {
    const { nodes, materials }: any = useGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    return (
        <animated.group
            position={position.clone().setY(stackHeight(stack, block) + 1)}
            rotation={animatedRotation}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Shade_Solo.geometry}
                material={materials['Material.Planks']}
            />
        </animated.group>
    );
}

export function BlockGrass({ stack, block, position, rotation }: EntityProps) {
    const { nodes, materials }: any = useGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    const variantResolved = 1;

    return (
        <animated.group
            position={position.clone().setY(stackHeight(stack, block) + 0.2)}
            rotation={animatedRotation}>
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
    const { nodes, materials }: any = useGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    const variantResolved = (variant ?? 1) % 2;

    return (
        <animated.group
            position={position.clone().setY(stackHeight(stack, block) + 1)}
            rotation={animatedRotation}>
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

export function RaisedBed({ stack, block, position }: EntityProps) {
    const { nodes, materials }: any = useGLTF(models.GameAssets.url)

    // Switch between shapes (O, L, I, U) based on neighbors
    let shape = "O";
    const stacks = useGameState(state => state.stacks);
    const currentInStackIndex = stack.blocks.indexOf(block);
    const neighbors = {
        w: getStack(stacks, { x: position.x, z: position.z + 1 })?.blocks.at(currentInStackIndex)?.name === entities.RaisedBed.name,
        n: getStack(stacks, { x: position.x + 1, z: position.z })?.blocks.at(currentInStackIndex)?.name === entities.RaisedBed.name,
        e: getStack(stacks, { x: position.x, z: position.z - 1 })?.blocks.at(currentInStackIndex)?.name === entities.RaisedBed.name,
        s: getStack(stacks, { x: position.x - 1, z: position.z })?.blocks.at(currentInStackIndex)?.name === entities.RaisedBed.name,
    };

    const numberOfNeighbors = Object.values(neighbors).filter(Boolean).length;
    let shapeRotation = 0;
    if (numberOfNeighbors === 1) {
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
    } else if (numberOfNeighbors === 2) {
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
    } else if (numberOfNeighbors === 3) {
        shape = "O"
    }

    // const [animatedRotation] = useAnimatedEntityRotation(shapeRotation);

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

type Stack = {
    position: THREE.Vector3,
    blocks: Block[]
}

type Block = {
    name: string,
    rotation: number
    variant?: number
}

function serializeGarden(garden: { stacks: Stack[] }) {
    return JSON.stringify(garden);
}

function deserializeGarden(serializedGarden: string) {
    return JSON.parse(serializedGarden);
}

function getDefaultGarden() {
    const size = 2;
    const stacks: Stack[] = [];
    for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
            stacks.push({
                position: new THREE.Vector3(x, 0, z),
                blocks: [
                    { name: entities.BlockGrass.name, rotation: Math.floor(Math.random() * 4) },
                ]
            });
        }
    }
    stacks.find(stack => stack.position.x === 0 && stack.position.z === 0)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });
    stacks.find(stack => stack.position.x === 1 && stack.position.z === 0)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });
    // stacks.find(stack => stack.position.x === 0 && stack.position.z === 1)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });
    // stacks.find(stack => stack.position.x === 0 && stack.position.z === 2)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });
    // stacks.find(stack => stack.position.x === 2 && stack.position.z === 0)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });

    return {
        stacks
    };
}

function useGarden() {
    return useQuery<{ stacks: Stack[] }>({
        queryKey: ['garden'],
        queryFn: async () => {
            // Load garden from local storage
            const serializedGarden = localStorage.getItem('garden');
            if (serializedGarden) {
                return deserializeGarden(serializedGarden);
            } else {
                const newGarden = deserializeGarden(serializeGarden(getDefaultGarden()));
                localStorage.setItem('garden', serializeGarden(newGarden));
                return newGarden;
            }
        },
        staleTime: 0
    })
}

function useUpdateGarden() {
    const queryClient = useQueryClient();
    return async ({ stacks }: { stacks: Stack[] }) => {
        const garden = { stacks: structuredClone(stacks) };

        // Garden cleanup
        // - remove empty stacks
        garden.stacks = garden.stacks.filter(stack => stack.blocks.length > 0);

        localStorage.setItem('garden', serializeGarden(garden));
        queryClient.invalidateQueries({ queryKey: ['garden'] });
    }
}

export function Garden() {
    const stacks = useGameState(state => state.stacks);
    const setStacks = useGameState(state => state.setStacks);
    const rotateBlock = useGameState(state => state.rotateBlock);

    // Load garden from remote
    const { data: garden } = useGarden();
    useEffect(() => {
        // Only update local state if we don't have any local state (first load or no stacks)
        if (stacks.length <= 0) {
            const { stacks } = garden ?? { stacks: [] };
            setStacks([...stacks]);
        }

        // TODO: Check if we are ou-of-sync with remote state and
        //       present user with "Reload" button (notification)
    }, [garden]);

    // Update garden remote state
    const updateGarden = useUpdateGarden();
    useEffect(() => {
        updateGarden({ stacks });
    }, [stacks]);

    const handleContextMenu = (stack: Stack, block: Block, blockIndex: number, event: ThreeEvent<MouseEvent>) => {
        event.nativeEvent.preventDefault()
        event.stopPropagation();
        rotateBlock(stack.position, blockIndex, block.rotation + 1);
    }

    return (
        <group>
            {stacks.map((stack) =>
                stack.blocks?.map((block, i) => {
                    return (
                        <group
                            key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.name}-${stack.blocks.filter(b => b.name === block.name).length - 1}`}
                            onContextMenu={(event) => handleContextMenu(stack, block, i, event)}>
                            <EntityFactory
                                name={block.name}
                                stack={stack}
                                block={block}
                                position={new THREE.Vector3(stack.position.x, 0, stack.position.z)}
                                rotation={block.rotation}
                                variant={block.variant} />
                        </group>
                    );
                })
            )}
        </group>
    )
}

function Environment() {
    const backgroundColor = new THREE.Color(0xE7E2CC);
    const sunColor = new THREE.Color(0xffffff);
    const cameraShadowSize = 100;
    const shadowMapSize = 10;

    return (
        <>
            <color attach="background" args={[backgroundColor]} />
            <ambientLight intensity={3} />
            <hemisphereLight
                color={0xffffbb}
                groundColor={0x360E0E}
                intensity={5}
                position={[0, 1, 0]}
            />
            {/* TODO: Update shadow camera position based on camera position */}
            <directionalLight
                color={sunColor}
                position={[-10, 10, 10]}
                intensity={5}
                shadow-mapSize={shadowMapSize * 1024}
                shadow-near={0.01}
                shadow-far={1000}
                shadow-normalBias={0.03}
                shadow-camera-left={-cameraShadowSize}
                shadow-camera-right={cameraShadowSize}
                shadow-camera-top={cameraShadowSize}
                shadow-camera-bottom={-cameraShadowSize}
                shadow-camera-near={0.01}
                shadow-camera-far={1000}
                castShadow />
        </>
    );
}

const queryClient = new QueryClient();

type GameState = {
    stacks: Stack[],
    setStacks: (stacks: Stack[]) => void,
    placeBlock: (to: THREE.Vector3, block: Block) => void,
    moveBlock: (from: THREE.Vector3, blockIndex: number, to: THREE.Vector3) => void,
    rotateBlock: (stackPosition: THREE.Vector3, blockIndex: number, rotation: number) => void
};

const useGameState = create<GameState>((set) => ({
    stacks: [],
    setStacks: (stacks) => set({ stacks }),
    placeBlock: (to, block) => set((state) => {
        let stack = getStack(state.stacks, to);
        if (!stack) {
            stack = { position: to, blocks: [] };
            state.stacks.push(stack);
        }

        stack.blocks.push(block);
        return { stacks: [...state.stacks] };
    }),
    moveBlock: (from, blockIndex, to) => set((state) => {
        if (from.x === to.x && from.z === to.z) {
            return state;
        }

        // Determine source stack and block
        const sourceStack = getStack(state.stacks, from);
        const block = sourceStack?.blocks[blockIndex];
        if (!block) {
            return state;
        }

        // Determine destination stack or create new one if it doesn't exist
        let destStack = getStack(state.stacks, to);
        if (!destStack) {
            destStack = { position: to, blocks: [] };
            state.stacks.push(destStack);
        }

        sourceStack?.blocks.splice(blockIndex, 1);
        destStack?.blocks.push(block);
        return { stacks: [...state.stacks] };
    }),
    rotateBlock: (stackPosition, blockIndex, rotation) => set((state) => {
        const stack = getStack(state.stacks, stackPosition);
        const block = stack?.blocks[blockIndex];
        if (!block) {
            return state;
        }

        block.rotation = rotation;
        return { stacks: [...state.stacks] };
    })
}));

function GameSceneProviders({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

export function GameScene() {
    const cameraPosition = 100;

    const placeBlock = useGameState(state => state.placeBlock);
    const handlePickBlock = (name: string) => {
        placeBlock(new THREE.Vector3(0, 0, 0), { name, rotation: 0 });
    };

    return (
        <div className='relative'>
            <div className='absolute h-full w-full'>
                <GameSceneProviders>
                    <Canvas
                        orthographic
                        shadows={{
                            type: THREE.PCFSoftShadowMap,
                            enabled: true,
                        }}
                        camera={{
                            position: cameraPosition,
                            zoom: 100,
                            far: 10000,
                            near: 0.01
                        }}>

                        <Environment />

                        <Garden />

                        <gridHelper args={[100, 100, '#B8B4A3', '#CFCBB7']} position={[0.5, 0, 0.5]} />

                        <OrbitControls
                            enableRotate={false}
                            minZoom={50}
                            maxZoom={200} />

                        <StatsGl />
                    </Canvas>
                </GameSceneProviders>
            </div>
            <div className='absolute pointer-events-none select-none h-full w-full [box-shadow:inset_0px_0px_8px_8px_var(--section-bg)]' />
            { /* Block picker */}
            <div className='absolute right-4 top-4 bg-white rounded-lg'>
                <ul>
                    <li>
                        <button onClick={() => handlePickBlock(entities.BlockGround.name)}>Zemlja</button>
                    </li>
                    <li>
                        <button onClick={() => handlePickBlock(entities.BlockGrass.name)}>Trava</button>
                    </li>
                    <li>
                        <button onClick={() => handlePickBlock(entities.RaisedBed.name)}>Gredica</button>
                    </li>
                    <li>
                        <button onClick={() => handlePickBlock(entities.Shade.name)}>Shade</button>
                    </li>
                </ul>
            </div>
        </div>
    );
}