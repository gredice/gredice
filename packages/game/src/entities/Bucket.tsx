import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WaterSurfaceMaterial } from './helpers/WaterSurfaceMaterial';

export function Bucket({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('Bucket');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            scale={[0.3, 0.25, 0.3]}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh castShadow receiveShadow geometry={nodes.Bucket_1.geometry}>
                <WaterSurfaceMaterial />
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
                <RainWetOverlay
                    geometry={nodes.Bucket_2.geometry}
                    topSurfaceBias={2.6}
                    glossiness={0.9}
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
                <RainWetOverlay geometry={nodes.Bucket_3.geometry} />
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
                <RainWetOverlay
                    geometry={nodes['Bucket_-_Handle'].geometry}
                    topSurfaceBias={3}
                    darkness={0.7}
                    glossiness={0.85}
                />
            </mesh>
        </animated.group>
    );
}
