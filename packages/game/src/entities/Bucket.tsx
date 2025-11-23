import { animated } from '@react-spring/three';
import { MeshDistortMaterial } from '@react-three/drei';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function Bucket({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            scale={[0.3, 0.25, 0.3]}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Bucket_1.geometry}
                material={materials['Material.Water']}
            >
                <MeshDistortMaterial
                    {...materials['Material.Water']}
                    distort={0.2}
                    speed={2}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Bucket_2.geometry}
                material={materials['Material.Metal']}
            >
                <SnowOverlay
                    geometry={nodes.Bucket_2.geometry}
                    maxThickness={0.06}
                    slopeExponent={3.5}
                    noiseScale={3.5}
                    coverageMultiplier={0.5}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Bucket_3.geometry}
                material={materials['Material.Planks']}
            >
                <SnowOverlay
                    geometry={nodes.Bucket_3.geometry}
                    maxThickness={0.08}
                    slopeExponent={2.8}
                    noiseScale={3.2}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes['Bucket_-_Handle'].geometry}
                material={nodes['Bucket_-_Handle'].material}
                scale={[3.333, 4, 3.333]}
            >
                <SnowOverlay
                    geometry={nodes['Bucket_-_Handle'].geometry}
                    maxThickness={0.04}
                    slopeExponent={4.5}
                    noiseScale={5}
                    coverageMultiplier={0.4}
                />
            </mesh>
        </animated.group>
    );
}
