import type { GameAssetName } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { animated } from '../scene/sceneSpring';
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
            {/* Colours come from the model: Material.DesertStone.Body and the
                pebbles' Material.DesertStone.Groove. */}
            <mesh
                castShadow
                receiveShadow
                geometry={body.geometry}
                material={body.material}
            >
                <SnowOverlay geometry={body.geometry} {...snowPresets.stone} />
                <RainWetOverlay geometry={body.geometry} />
            </mesh>
            {grooves ? (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={grooves.geometry}
                    material={grooves.material}
                />
            ) : null}
        </animated.group>
    );
}
