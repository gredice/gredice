import { animated } from '@react-spring/three';
import { MeshDistortMaterial } from '@react-three/drei';
import { DoubleSide } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type InflatablePoolSmallNodeName = Extract<
    keyof GLTFResult['nodes'],
    `InflatablePoolSmall_${string}`
>;
type InflatablePoolSmallNode = GLTFResult['nodes'][InflatablePoolSmallNodeName];

const inflatablePoolSmallScale = 0.33;

const solidNodeNames = [
    'InflatablePoolSmall_OuterRingBottom',
    'InflatablePoolSmall_OuterRingMiddle',
    'InflatablePoolSmall_OuterRingTop',
    'InflatablePoolSmall_InnerWall',
] satisfies InflatablePoolSmallNodeName[];

function InflatablePoolSmallPart({ node }: { node: InflatablePoolSmallNode }) {
    return (
        <mesh
            castShadow
            receiveShadow
            geometry={node.geometry}
            material={node.material}
            position={node.position}
            rotation={node.rotation}
            scale={node.scale}
        >
            <SnowOverlay
                geometry={node.geometry}
                maxThickness={0.035}
                slopeExponent={3}
                noiseScale={3.4}
                coverageMultiplier={0.42}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.8}
                glossiness={0.68}
            />
        </mesh>
    );
}

export function InflatablePoolSmall({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('InflatablePoolSmall');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const position = stack.position.clone().setY(currentStackHeight + 0.015);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={inflatablePoolSmallScale}
        >
            {solidNodeNames.map((nodeName) => (
                <InflatablePoolSmallPart
                    key={nodeName}
                    node={nodes[nodeName]}
                />
            ))}
            <mesh
                geometry={nodes.InflatablePoolSmall_Water.geometry}
                position={nodes.InflatablePoolSmall_Water.position}
                rotation={nodes.InflatablePoolSmall_Water.rotation}
                scale={nodes.InflatablePoolSmall_Water.scale}
            >
                <MeshDistortMaterial
                    color="#14a7d3"
                    depthWrite={false}
                    distort={0.1}
                    metalness={0.28}
                    opacity={0.72}
                    roughness={0.2}
                    side={DoubleSide}
                    speed={1.2}
                    transparent
                />
            </mesh>
        </animated.group>
    );
}
