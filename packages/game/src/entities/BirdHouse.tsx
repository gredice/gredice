import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BirdHouse({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BirdHouse');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Birdhouse_Angled_Supports.geometry}
                material={nodes.Birdhouse_Angled_Supports.material}
            >
                <SnowOverlay
                    geometry={nodes.Birdhouse_Angled_Supports.geometry}
                    maxThickness={0.08}
                    slopeExponent={2.8}
                    noiseScale={3}
                />
                <RainWetOverlay
                    geometry={nodes.Birdhouse_Angled_Supports.geometry}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Birdhouse_Center_Post.geometry}
                material={nodes.Birdhouse_Center_Post.material}
            >
                <SnowOverlay
                    geometry={nodes.Birdhouse_Center_Post.geometry}
                    maxThickness={0.04}
                    slopeExponent={4}
                    noiseScale={3.5}
                    coverageMultiplier={0.35}
                />
                <RainWetOverlay
                    geometry={nodes.Birdhouse_Center_Post.geometry}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Birdhouse_Upper_Platform.geometry}
                material={nodes.Birdhouse_Upper_Platform.material}
            >
                <SnowOverlay
                    geometry={nodes.Birdhouse_Upper_Platform.geometry}
                    maxThickness={0.07}
                    slopeExponent={2.6}
                    noiseScale={3}
                />
                <RainWetOverlay
                    geometry={nodes.Birdhouse_Upper_Platform.geometry}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Birdhouse_Cabin_Walls.geometry}
                material={nodes.Birdhouse_Cabin_Walls.material}
            >
                <SnowOverlay
                    geometry={nodes.Birdhouse_Cabin_Walls.geometry}
                    maxThickness={0.05}
                    slopeExponent={3}
                    noiseScale={3.5}
                    coverageMultiplier={0.45}
                />
                <RainWetOverlay
                    geometry={nodes.Birdhouse_Cabin_Walls.geometry}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Birdhouse_Perch.geometry}
                material={nodes.Birdhouse_Perch.material}
            >
                <SnowOverlay
                    geometry={nodes.Birdhouse_Perch.geometry}
                    maxThickness={0.03}
                    slopeExponent={4}
                    noiseScale={4}
                    coverageMultiplier={0.3}
                />
                <RainWetOverlay geometry={nodes.Birdhouse_Perch.geometry} />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Birdhouse_Roof_Panels.geometry}
                material={nodes.Birdhouse_Roof_Panels.material}
            >
                <SnowOverlay
                    geometry={nodes.Birdhouse_Roof_Panels.geometry}
                    maxThickness={0.12}
                    slopeExponent={2.4}
                    noiseScale={2.8}
                />
                <RainWetOverlay
                    geometry={nodes.Birdhouse_Roof_Panels.geometry}
                    topSurfaceBias={2.2}
                    glossiness={0.65}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Birdhouse_Ridge_Cap.geometry}
                material={nodes.Birdhouse_Ridge_Cap.material}
            >
                <SnowOverlay
                    geometry={nodes.Birdhouse_Ridge_Cap.geometry}
                    maxThickness={0.08}
                    slopeExponent={2.8}
                    noiseScale={3}
                />
                <RainWetOverlay
                    geometry={nodes.Birdhouse_Ridge_Cap.geometry}
                    topSurfaceBias={2.4}
                    glossiness={0.7}
                />
            </mesh>
        </animated.group>
    );
}
