'use client';

import {
    useQuery,
    QueryClient,
    QueryClientProvider,
    useQueryClient,
} from '@tanstack/react-query';
import * as THREE from 'three'
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { PointerEvent, PropsWithChildren, useEffect, useMemo, useState } from 'react'
import { Handler, useDrag } from '@use-gesture/react'
import { useSpring, animated } from '@react-spring/three'

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
    [entities.RaisedBed.name]: RaisedBed
}

function EntityFactory({ name, stack, block, position, ...rest }: { name: string } & EntityProps) {
    const EntityComponent = entityNameMap[name];
    if (!EntityComponent) {
        return null;
    }

    const { data: garden } = useGarden();
    const updateGarden = useUpdateGarden();
    const { stacks } = garden ?? { stacks: [] };
    const handlePositionChanged = (movement: THREE.Vector3) => {
        // Remove block from current stack
        stack.blocks.splice(stack.blocks.length - 1, 1);

        // Add block to destination stack
        const dest = position.clone().add(movement).setY(0);
        let destStack = stacks.find(stack => stack.position.x === dest.x && stack.position.z === dest.z);
        if (!destStack) {
            destStack = { position: dest, blocks: [] };
            stacks.push(destStack);
        }
        destStack.blocks.push(block);

        // Update state
        updateGarden([...stacks]);
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
    const { data: garden } = useGarden();
    const { stacks } = garden ?? { stacks: [] };

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
    const rect = useMemo(() => domElement.getClientRects()[0], [domElement]);
    const dragState = useMemo(() => ({
        pt: new THREE.Vector3(),
        dest: new THREE.Vector3(),
        relative: new THREE.Vector3()
    }), []);
    const currentStackHeight = useMemo(() => stackHeight(stack, block), [stack, block]);

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
            api.start({ internalPosition: [relative.x, hoveredStackHeight, relative.z] })[0].then(() => {
                onPositionChanged(relative);
            });
        } else {
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

    return [springs.rotation];
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
                geometry={nodes.Block_Grass_1_1.geometry}
                material={materials['Material.GrassPart']}
            />
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
                material={materials['Material.Dirt']}
            />
        </animated.group>
    );
}

export function RaisedBed({ stack, block, position, rotation }: EntityProps) {
    const { nodes, materials }: any = useGLTF(models.GameAssets.url)
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    // Switch between shapes (O, L, I, U) based on neighbors
    let shape = "O";
    const { data: garden } = useGarden();
    const { stacks } = garden ?? { stacks: [] };
    const neighbors = [
        getStack(stacks, { x: position.x, z: position.z + 1 }),
        getStack(stacks, { x: position.x + 1, z: position.z }),
        getStack(stacks, { x: position.x, z: position.z - 1 }),
        getStack(stacks, { x: position.x - 1, z: position.z }),
    ];
    if (neighbors[0] && neighbors[1] && neighbors[2] && neighbors[3]) {
        // O shape
    } else if (neighbors[0] && neighbors[1] && neighbors[2]) {
        // L shape
        shape = "L";
    } else if (neighbors[1] && neighbors[2] && neighbors[3]) {
        // I shape
        shape = "I";
    } else if (neighbors[2] && neighbors[3] && neighbors[0]) {
        // U shape
        shape = "U";
    } else if (neighbors[3] && neighbors[0] && neighbors[1]) {
        // U shape
        shape = "U";
    } else if (neighbors[0] && neighbors[2]) {
        // L shape
        shape = "L";
    } else if (neighbors[1] && neighbors[3]) {
        // I shape
        shape = "I";
    } else if (neighbors[0] && neighbors[1]) {
        // O shape
    } else if (neighbors[1] && neighbors[2]) {
        // L shape
        shape = "L";
    } else if (neighbors[2] && neighbors[3]) {
        // I shape
        shape = "I";
    } else if (neighbors[3] && neighbors[0]) {
        // L shape
        shape = "L";
    } else if (neighbors[0]) {
        // O shape
    } else if (neighbors[1]) {
        // I shape
        shape = "I";
    } else if (neighbors[2]) {
        // O shape
    } else if (neighbors[3]) {
        // I shape
        shape = "I";
    } else {
        // O shape
    }

    return (
        <animated.group
            position={position.clone().setY(stackHeight(stack, block) + 1)}
            rotation={animatedRotation}>
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
    stacks.find(stack => stack.position.x === 0 && stack.position.z === 1)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });
    stacks.find(stack => stack.position.x === 0 && stack.position.z === 2)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });
    stacks.find(stack => stack.position.x === 2 && stack.position.z === 0)?.blocks.push({ name: entities.RaisedBed.name, rotation: 0 });

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
                console.log('useGarden', serializedGarden);
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
    return async (stacks: Stack[]) => {
        const garden = { stacks: structuredClone(stacks) };

        // Garden cleanup
        // - remove empty stacks
        garden.stacks = garden.stacks.filter(stack => stack.blocks.length > 0);

        localStorage.setItem('garden', serializeGarden(garden));
        queryClient.invalidateQueries({ queryKey: ['garden'] });
    }
}

export function Garden() {
    const { data: garden } = useGarden();
    const { stacks } = garden ?? { stacks: [] };
    const updateGarden = useUpdateGarden();
    const [, setRefresh] = useState(0);

    const handleContextMenu = (block: Block, event: ThreeEvent<MouseEvent>) => {
        event.nativeEvent.preventDefault()
        event.stopPropagation();

        block.rotation++;

        updateGarden([...stacks]);
        setRefresh(curr => curr + 1);
    }

    return (
        <group>
            {stacks.map((stack) =>
                stack.blocks?.map((block, i) => {
                    return (
                        <group
                            key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${i}-${block.name}`}
                            onContextMenu={(event) => handleContextMenu(block, event)}>
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
    const cameraShadowSize = 30;
    const shadowMapSize = 5;

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
            <directionalLight
                color={sunColor}
                position={[-1, 1, 1]}
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

function GameSceneProviders({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

export function GameScene() {
    const cameraPosition = 100;

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

                        {/* <gridHelper rotation={[Math.PI / 2, 0, 0]} args={[10, 100, '#B8B4A3', '#CFCBB7']} position={[0, 0, 0]} />
                <gridHelper args={[100, 100, '#B8B4A3', '#CFCBB7']} position={[0, 0, 0]} /> */}

                        <OrbitControls
                            enableRotate={false}
                            minZoom={50}
                            maxZoom={200} />
                    </Canvas>
                </GameSceneProviders>
            </div>
            <div className='absolute pointer-events-none select-none h-full w-full [box-shadow:inset_0px_0px_8px_8px_var(--section-bg)]' />
        </div>
    );
}