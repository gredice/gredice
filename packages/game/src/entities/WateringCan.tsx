import type { ReactNode } from 'react';
import { DoubleSide } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { animated } from '../scene/sceneSpring';
import { seasonalRoles } from '../scene/seasonalRoles';
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

// Linear albedo in sRGB hex: the scene lights a sunlit face to about 3.2
// times its albedo (assets/scripts/party-pass-props.py). Enamel blue body
// #3f8ff0 and holiday gold trim #f2c040 from the roles in GAME_ART.md, and a
// steel rose plate #8fc0ee.
export const wateringCanBodyMaterial = {
    color: seasonalRoles.enamelBlue.albedo,
    metalness: 0,
    roughness: seasonalRoles.enamelBlue.roughness,
    side: DoubleSide,
};

export const wateringCanTrimMaterial = {
    color: seasonalRoles.holidayGold.albedo,
    metalness: 0,
    roughness: seasonalRoles.holidayGold.roughness,
    side: DoubleSide,
};

export const wateringCanRoseMaterial = {
    color: '#5a7895',
    metalness: 0,
    roughness: 0.3,
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
                        <meshStandardMaterial {...wateringCanBodyMaterial} />
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
                        <meshStandardMaterial {...wateringCanTrimMaterial} />
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
                        <meshStandardMaterial {...wateringCanRoseMaterial} />
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
