import { animated } from '@react-spring/three';
import { MeshDistortMaterial } from '@react-three/drei';
import type { ReactNode } from 'react';
import { DoubleSide } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type WateringCanNodeName = Extract<
    keyof GLTFResult['nodes'],
    `WateringCan_${string}`
>;
type WateringCanNode = GLTFResult['nodes'][WateringCanNodeName];

const bodyNodeNames = [
    'WateringCan_Body',
    'WateringCan_Spout',
] satisfies WateringCanNodeName[];

const trimNodeNames = [
    'WateringCan_Base_Ring',
    'WateringCan_Fill_Rim',
    'WateringCan_Handle',
    'WateringCan_Rose_Head',
] satisfies WateringCanNodeName[];

const darkNodeNames = [
    'WateringCan_Rose_Face_Dots',
] satisfies WateringCanNodeName[];

const metalMaterial = {
    color: '#555555',
    metalness: 0,
    roughness: 0.5,
    side: DoubleSide,
};

const wateringCanScale = 0.35;

function WateringCanPart({
    children,
    node,
}: {
    children: ReactNode;
    node: WateringCanNode;
}) {
    return (
        <mesh
            castShadow
            receiveShadow
            geometry={node.geometry}
            position={node.position}
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
        </mesh>
    );
}

export function WateringCan({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('WateringCan');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={wateringCanScale}
        >
            {bodyNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <WateringCanPart key={nodeName} node={node}>
                        <meshStandardMaterial {...metalMaterial} />
                        <SnowOverlay
                            geometry={node.geometry}
                            {...snowPresets.tool}
                        />
                        <RainWetOverlay
                            geometry={node.geometry}
                            topSurfaceBias={2.8}
                            darkness={0.82}
                            glossiness={0.88}
                        />
                    </WateringCanPart>
                );
            })}
            {trimNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <WateringCanPart key={nodeName} node={node}>
                        <meshStandardMaterial {...metalMaterial} />
                        <SnowOverlay
                            geometry={node.geometry}
                            {...snowPresets.tool}
                        />
                        <RainWetOverlay
                            geometry={node.geometry}
                            topSurfaceBias={3}
                            darkness={0.75}
                            glossiness={0.9}
                        />
                    </WateringCanPart>
                );
            })}
            {darkNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <WateringCanPart key={nodeName} node={node}>
                        <meshStandardMaterial {...metalMaterial} />
                        <SnowOverlay
                            geometry={node.geometry}
                            {...snowPresets.tool}
                        />
                        <RainWetOverlay geometry={node.geometry} />
                    </WateringCanPart>
                );
            })}
            <WateringCanPart node={nodes.WateringCan_Water}>
                <MeshDistortMaterial
                    color="#3598e7"
                    depthWrite={false}
                    distort={0.2}
                    metalness={0.8}
                    opacity={0.6}
                    roughness={0.2}
                    side={DoubleSide}
                    speed={2}
                    transparent
                />
            </WateringCanPart>
        </animated.group>
    );
}
