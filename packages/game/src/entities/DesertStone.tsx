import { animated } from '@react-spring/three';
import { DoubleSide } from 'three';
import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type DesertStoneAssetName = Extract<GameAssetName, `DesertStone${string}`>;
type DesertStoneNodeName = Extract<
    keyof GLTFResult['nodes'],
    `DesertStone${string}`
>;

type DesertStoneConfig = {
    assetName: DesertStoneAssetName;
    bodyNode: DesertStoneNodeName;
    groovesNode?: DesertStoneNodeName;
    scale: [number, number, number];
};

const desertStoneConfigs = {
    DesertStoneSmall: {
        assetName: 'DesertStoneSmall',
        bodyNode: 'DesertStoneSmall_Body',
        groovesNode: 'DesertStoneSmall_Crevices',
        scale: [0.165, 0.165, 0.165],
    },
    DesertStoneMedium: {
        assetName: 'DesertStoneMedium',
        bodyNode: 'DesertStoneMedium_Body',
        groovesNode: 'DesertStoneMedium_Crevices',
        scale: [0.236, 0.269, 0.205],
    },
    DesertStoneLarge: {
        assetName: 'DesertStoneLarge',
        bodyNode: 'DesertStoneLarge_Body',
        groovesNode: 'DesertStoneLarge_Crevices',
        scale: [0.263, 0.426, 0.291],
    },
} satisfies Record<string, DesertStoneConfig>;

type DesertStoneName = keyof typeof desertStoneConfigs;

const desertStoneBodyMaterial = {
    color: '#d86a2f',
    roughness: 0.88,
    metalness: 0,
};

const desertStoneGrooveMaterial = {
    color: '#a04322',
    roughness: 0.94,
    metalness: 0,
    side: DoubleSide,
};

function isDesertStoneName(name: string): name is DesertStoneName {
    return name in desertStoneConfigs;
}

export function DesertStone({ stack, block, rotation }: EntityInstanceProps) {
    const config = isDesertStoneName(block.name)
        ? desertStoneConfigs[block.name]
        : desertStoneConfigs.DesertStoneSmall;
    const { nodes } = useGameGLTF(config.assetName);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const body = nodes[config.bodyNode];
    const grooves = config.groovesNode ? nodes[config.groovesNode] : null;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={config.scale}
        >
            <mesh castShadow receiveShadow geometry={body.geometry}>
                <meshStandardMaterial {...desertStoneBodyMaterial} />
                <SnowOverlay geometry={body.geometry} {...snowPresets.stone} />
                <RainWetOverlay geometry={body.geometry} />
            </mesh>
            {grooves ? (
                <mesh castShadow receiveShadow geometry={grooves.geometry}>
                    <meshStandardMaterial {...desertStoneGrooveMaterial} />
                </mesh>
            ) : null}
        </animated.group>
    );
}
