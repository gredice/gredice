import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { getArrowSignConfig } from './signageConfig';

const arrowSignFallbackColor = '#f4ead7';

export function ArrowSign({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('ArrowSign');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const config = getArrowSignConfig(block.name);
    const faceRotation = config?.faceRotation ?? 0;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.ArrowSign_Post.geometry}
                material={nodes.ArrowSign_Post.material}
                position={nodes.ArrowSign_Post.position}
                rotation={nodes.ArrowSign_Post.rotation}
                scale={nodes.ArrowSign_Post.scale}
            >
                <SnowOverlay
                    geometry={nodes.ArrowSign_Post.geometry}
                    maxThickness={0.025}
                    slopeExponent={4}
                    noiseScale={4}
                    coverageMultiplier={0.3}
                />
                <RainWetOverlay geometry={nodes.ArrowSign_Post.geometry} />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.ArrowSign_Arrow.geometry}
                position={nodes.ArrowSign_Arrow.position}
                rotation={[
                    nodes.ArrowSign_Arrow.rotation.x,
                    nodes.ArrowSign_Arrow.rotation.y,
                    nodes.ArrowSign_Arrow.rotation.z + faceRotation,
                ]}
                scale={nodes.ArrowSign_Arrow.scale}
            >
                <meshStandardMaterial
                    color={config?.colorHex ?? arrowSignFallbackColor}
                    roughness={0.88}
                    metalness={0}
                />
                <SnowOverlay
                    geometry={nodes.ArrowSign_Arrow.geometry}
                    maxThickness={0.035}
                    slopeExponent={3.2}
                    noiseScale={3.6}
                    coverageMultiplier={0.5}
                />
                <RainWetOverlay
                    geometry={nodes.ArrowSign_Arrow.geometry}
                    topSurfaceBias={2.6}
                    darkness={0.82}
                    glossiness={0.58}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.ArrowSign_Fastener.geometry}
                material={nodes.ArrowSign_Fastener.material}
                position={nodes.ArrowSign_Fastener.position}
                rotation={nodes.ArrowSign_Fastener.rotation}
                scale={nodes.ArrowSign_Fastener.scale}
            >
                <SnowOverlay
                    geometry={nodes.ArrowSign_Fastener.geometry}
                    maxThickness={0.008}
                    slopeExponent={4}
                    noiseScale={5}
                    coverageMultiplier={0.15}
                />
                <RainWetOverlay
                    geometry={nodes.ArrowSign_Fastener.geometry}
                    glossiness={0.68}
                />
            </mesh>
        </animated.group>
    );
}
