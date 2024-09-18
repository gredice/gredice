'use client';

import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { useSpring, animated } from '@react-spring/three'

const models = {
    GameAssets: { url: '/assets/models/GameAssets.glb' }
}

const entities = {
    BlockGround: {
        name: 'Block_Ground',
        height: 0.3,
        stackable: true
    },
    RaisedBed: {
        name: 'Raised_Bed'
    }
};

useGLTF.preload(models.GameAssets.url);

function Pickup({ children, position, onPositionChanged }: { children: React.ReactNode, position: THREE.Vector3, onPositionChanged: (movement: THREE.Vector3) => void }) {
    const [springs, api] = useSpring(() => ({
        from: { internalPosition: [0, 0, 0] },
        config: {
            mass: 0.1,
            tension: 200,
            friction: 10
        }
    }));

    useEffect(() => {
        console.log('position changed', position);
        api.set({ internalPosition: [0, 0, 0] });
    }, [position]);

    const camera = useThree(state => state.camera);
    const domElement = useThree(state => state.gl.domElement);

    const dragHandler = ({ pressed, initial, movement, event }) => {
        event.stopPropagation();

        console.log('position drag start', position);

        const rect = domElement.getClientRects()[0];
        const pointerClientX = initial[0] + movement[0];
        const pointerClientY = initial[1] + movement[1];
        const raycaster = new THREE.Raycaster()
        const pt = new THREE.Vector3()
        pt.set(
            ((pointerClientX - rect.left) / rect.width) * 2 - 1,
            ((rect.top - pointerClientY) / rect.height) * 2 + 1,
            1
        )

        raycaster.setFromCamera(new THREE.Vector2(pt.x, pt.y), camera)

        const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
        const isIntersecting = raycaster.ray.intersectPlane(ground, pt);
        if (!isIntersecting) {
            return;
        }

        const dest = new THREE.Vector3(Math.round(pt.x), 0, Math.round(pt.z));
        const relative = dest.sub(position).setY(0);

        if (pressed) {
            if (!isIntersecting) {
                return;
            }

            api.start({ internalPosition: [relative.x, 0.3, relative.z] });
        } else {
            api.start({ internalPosition: [relative.x, 0, relative.z] })[0].then(() => {
                onPositionChanged(relative);
            });
        }
    };

    const bind = useDrag(dragHandler);

    return (
        <animated.group
            position={springs.internalPosition}
            {...bind()}>
            {children}
        </animated.group>
    )
}

export function BlockGround({ position, rotation, variant = 1 }: { position: THREE.Vector3, rotation: number, variant: number }) {
    const { nodes, materials }: any = useGLTF(models.GameAssets.url);
    const [internalPosition, setInternalPosition] = useState(position);

    const handlePositionChanged = (movement: THREE.Vector3) => {
        console.log('Block position changed', movement, 'to', internalPosition.clone().add(movement));
        setInternalPosition((curr) => curr.clone().add(movement));
    }

    return (
        <Pickup
            position={internalPosition}
            onPositionChanged={handlePositionChanged}>
            <group
                position={internalPosition.add(new THREE.Vector3(0, 1, 0))}
                rotation={[0, rotation, 0]}
            >
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[`Block_Ground_${variant}_1`].geometry}
                    material={nodes[`Block_Ground_${variant}_1`].material}
                />
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[`Block_Ground_${variant}_2`].geometry}
                    material={materials['Material.Dirt']}
                />
            </group>
        </Pickup >
    )
}

export function RaisedBed({ position }: { position: THREE.Vector3 }) {
    const { nodes, materials }: any = useGLTF(models.GameAssets.url)
    return (
        <group position={position.add(new THREE.Vector3(0, 1, 0))}>
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
        </group>
    )
}

export function Garden() {
    const groundSize = 10;

    return (
        <group>
            {(new Array(groundSize)).fill(0).map((_, i) => (
                (new Array(groundSize)).fill(0).map((_, j) => (
                    <group key={`${i}|${j}`}>
                        <BlockGround
                            key={j}
                            position={new THREE.Vector3(i - 5, 0, j - 5)}
                            rotation={i * j * Math.PI / 2}
                            variant={2}
                        />
                    </group>
                ))
            ))}
            <RaisedBed position={new THREE.Vector3(0, 0.5, 0)} />
        </group>
    )
}

function Environment({ sunDirection }: { sunDirection: THREE.Vector3 }) {
    const sunColor = new THREE.Color(0xffffff);
    const cameraShadowSize = 30;
    const shadowMapSize = 5;

    return (
        <>
            <color attach="background" args={['skyblue']} />
            <ambientLight intensity={3} />
            <hemisphereLight
                color={0xffffbb}
                groundColor={0x360E0E}
                intensity={5}
                position={[0, 1, 0]}
            />
            <directionalLight
                color={sunColor}
                position={sunDirection}
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

export function GameScene() {
    const cameraPosition = 100;

    const [sunDirection, setSunDirection] = useState(new THREE.Vector3(-0.5, 1, 0.3));

    return (
        <div className='h-screen w-full'>
            <Canvas
                orthographic
                shadows={{
                    type: THREE.PCFSoftShadowMap,
                    enabled: true,
                }}
                camera={{
                    position: [cameraPosition, cameraPosition, cameraPosition],
                    zoom: 75,
                    far: 10000,
                    near: 0.01
                }}>

                <Environment sunDirection={sunDirection} />

                <Garden />

                <gridHelper args={[100, 100, '#222', '#999']} position={[0, 0, 0]} />

                {/* <OrbitControls /> */}
            </Canvas>
            <div className='fixed top-0 left-0'>
                <input type='range' min='-100' max='100' step='0.01' value={sunDirection.x} onChange={(e) => setSunDirection(new THREE.Vector3(parseFloat(e.target.value), sunDirection.y, sunDirection.z))} />
                <input type='range' min='-100' max='100' step='0.01' value={sunDirection.y} onChange={(e) => setSunDirection(new THREE.Vector3(sunDirection.x, parseFloat(e.target.value), sunDirection.z))} />
                <input type='range' min='-100' max='100' step='0.01' value={sunDirection.z} onChange={(e) => setSunDirection(new THREE.Vector3(sunDirection.x, sunDirection.y, parseFloat(e.target.value)))} />
            </div>
        </div>
    );
}