import { animated } from '@react-spring/three';
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
import { WaterSurfaceMaterial } from './helpers/WaterSurfaceMaterial';

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
                <WaterSurfaceMaterial />
            </WateringCanPart>
        </animated.group>
    );
}
