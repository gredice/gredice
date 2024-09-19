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
import { PropsWithChildren, useEffect, useState } from 'react'
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

const entities: Record<string, Entity> = {
    BlockGround: {
        name: 'Block_Ground',
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

type EntityProps = {
    stack: Stack,
    block: Block,
    position: THREE.Vector3,
    rotation: number
    variant?: number
}

function EntityFactory({ name, ...rest }: { name: string } & EntityProps) {
    switch (name) {
        case entities.BlockGround.name:
            return <BlockGround {...rest} />
        case entities.RaisedBed.name:
            return <RaisedBed {...rest} />
        default:
            return null;
    }
}

useGLTF.preload(models.GameAssets.url);

function Pickup({ children, stack, block, position, onPositionChanged }: { children: React.ReactNode, stack: Stack, block: Block, position: THREE.Vector3, onPositionChanged: (movement: THREE.Vector3) => void }) {
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

    useEffect(() => {
        api.set({ internalPosition: [0, 0, 0] });
    }, [position]);

    const camera = useThree(state => state.camera);
    const domElement = useThree(state => state.gl.domElement);

    const dragHandler: Handler<"drag", any> = ({ pressed, initial, movement, event }) => {
        event.stopPropagation();

        const rect = domElement.getClientRects()[0];
        const pointerClientX = initial[0] + movement[0];
        const pointerClientY = initial[1] + movement[1];
        const raycaster = new THREE.Raycaster()
        const pt = new THREE.Vector3()
        pt.set(
            ((pointerClientX - rect.left) / rect.width) * 2 - 1,
            ((rect.top - pointerClientY) / rect.height) * 2 + 1,
            1
        );

        raycaster.setFromCamera(new THREE.Vector2(pt.x, pt.y), camera)

        const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
        const isIntersecting = raycaster.ray.intersectPlane(ground, pt);
        if (!isIntersecting) {
            return;
        }

        const dest = new THREE.Vector3(Math.round(pt.x), 0, Math.round(pt.z));
        const relative = dest.clone().sub(position).setY(0);

        const hoveredStack = stacks.find(stack => stack.position.x === dest.x && stack.position.z === dest.z);
        const hoveredStackHeight = hoveredStack === stack ? 0 : stackHeight(hoveredStack);

        if (pressed) {
            if (!isIntersecting) {
                return;
            }

            api.start({ internalPosition: [relative.x, hoveredStackHeight + 0.1, relative.z] });
        } else {
            api.start({ internalPosition: [relative.x, hoveredStackHeight, relative.z] })[0].then(() => {
                onPositionChanged(relative);
            });
        }
    };

    const bind = useDrag(dragHandler, {
        filterTaps: true,
        enabled: stack.blocks.at(-1) === block
    });

    return (
        <animated.group
            position={springs.internalPosition}
            {...bind()}>
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

export function BlockGround({ stack, block, position, rotation, variant }: EntityProps) {
    const { nodes, materials }: any = useGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

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

    const variantResolved = (variant ?? 1) % 2;

    return (
        <Pickup
            stack={stack}
            block={block}
            position={position}
            onPositionChanged={handlePositionChanged}>
            <animated.group
                position={position.clone().add(new THREE.Vector3(0, stackHeight(stack, block) + 1, 0))}
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
        </Pickup>
    )
}

export function RaisedBed({ stack, block, position, rotation }: EntityProps) {
    const { nodes, materials }: any = useGLTF(models.GameAssets.url)
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    const [internalPosition, setInternalPosition] = useState(position);
    const handlePositionChanged = (movement: THREE.Vector3) => {
        const dest = internalPosition.clone().add(movement);
        console.log('Block position changed', movement, 'to', dest);
        setInternalPosition(dest);
    }

    return (
        <Pickup
            stack={stack}
            block={block}
            position={internalPosition}
            onPositionChanged={handlePositionChanged}>
            <animated.group
                position={position.clone().add(new THREE.Vector3(0, stackHeight(stack, block) + 1, 0))}
                rotation={animatedRotation}>
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Raised_Bed_I_2.geometry}
                    material={materials['Material.Planks']}
                />
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Raised_Bed_I_1.geometry}
                    material={materials['Material.Dirt']}
                />
            </animated.group>
        </Pickup>
    )
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
    return ({
        stacks: [
            {
                position: new THREE.Vector3(0, 0, 0),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 },
                    { name: entities.RaisedBed.name, rotation: 0 }
                ]
            },
            {
                position: new THREE.Vector3(1, 0, 0),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 }
                ]
            },
            {
                position: new THREE.Vector3(0, 0, 1),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 }
                ]
            },
            {
                position: new THREE.Vector3(1, 0, 1),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 }
                ]
            },
            {
                position: new THREE.Vector3(-1, 0, 1),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 }
                ]
            },
            {
                position: new THREE.Vector3(-1, 0, -1),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 }
                ]
            },
            {
                position: new THREE.Vector3(1, 0, -1),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 }
                ]
            },
            {
                position: new THREE.Vector3(-1, 0, 0),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 }
                ]
            },
            {
                position: new THREE.Vector3(0, 0, -1),
                blocks: [
                    { name: entities.BlockGround.name, rotation: 0 }
                ]
            },
        ]
    });
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
    const sunColor = new THREE.Color(0xffffff);
    const cameraShadowSize = 30;
    const shadowMapSize = 5;

    return (
        <>
            <color attach="background" args={[0xE7E2CC]} />
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
            {/* <mesh position={sunDirection} scale={[2, 2, 2]}>
                <sphereGeometry args={[0.1, 32, 32]} />
                <meshBasicMaterial color={sunColor} />
            </mesh> */}
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

    const [sunDirection] = useState(new THREE.Vector3(-1, 1, 1));

    return (
        <div className='h-screen w-full'>
            <GameSceneProviders>
                <Canvas
                    orthographic
                    shadows={{
                        type: THREE.PCFSoftShadowMap,
                        enabled: true,
                    }}
                    camera={{
                        position: [cameraPosition, cameraPosition, cameraPosition],
                        zoom: 100,
                        far: 10000,
                        near: 0.01
                    }}>

                    <Environment />

                    <Garden />

                    {/* <gridHelper rotation={[Math.PI / 2, 0, 0]} args={[10, 100, '#B8B4A3', '#CFCBB7']} position={[0, 0, 0]} />
                <gridHelper args={[100, 100, '#B8B4A3', '#CFCBB7']} position={[0, 0, 0]} /> */}

                    <OrbitControls enableRotate={false} />
                </Canvas>
            </GameSceneProviders>
        </div>
    );
}