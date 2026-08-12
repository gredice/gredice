import { animated } from '@react-spring/three';
import type { Mesh } from 'three';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

const stoneRain = {
    darkness: 0.8,
    glossiness: 0.72,
    topSurfaceBias: 2.2,
};

function resolveTerrainAssetName(blockName: string) {
    switch (blockName) {
        case 'Block_Stone_Angle':
            return 'BlockStoneAngle';
        case 'Block_Gravel':
            return 'BlockGravel';
        case 'Block_Gravel_Angle':
            return 'BlockGravelAngle';
        case 'Block_Stone_Stairs':
            return 'BlockStoneStairs';
        case 'Block_Stone_Stairs_Corner':
        case 'Block_Stone_Stairs_Half':
            return 'BlockStoneStairsCorner';
        case 'Block_Polished_Stone_Angle':
            return 'BlockPolishedStoneAngle';
        case 'Block_Polished_Stone_Stairs':
            return 'BlockPolishedStoneStairs';
        case 'Block_Polished_Stone_Stairs_Corner':
            return 'BlockPolishedStoneStairsCorner';
        case 'Block_Polished_Stone':
            return 'BlockPolishedStone';
        default:
            return 'BlockStone';
    }
}

export function BlockTerrainVariationAsset({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const assetName = resolveTerrainAssetName(block.name);
    const { nodes } = useGameGLTF(assetName);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    let parts: Mesh[];

    switch (assetName) {
        case 'BlockStoneAngle':
            parts = [
                nodes.Block_Stone_Angle_Large,
                nodes.Block_Stone_Angle_Mid,
                nodes.Block_Stone_Angle_Dark,
            ];
            break;
        case 'BlockGravel':
            parts = [
                nodes.Block_Gravel_Base,
                nodes.Block_Gravel_Pieces_Light,
                nodes.Block_Gravel_Pieces_Dark,
            ];
            break;
        case 'BlockGravelAngle':
            parts = [
                nodes.Block_Gravel_Angle_Base,
                nodes.Block_Gravel_Angle_Pieces_Light,
                nodes.Block_Gravel_Angle_Pieces_Dark,
            ];
            break;
        case 'BlockStoneStairs':
            parts = [
                nodes.Block_Stone_Stairs_Large,
                nodes.Block_Stone_Stairs_Mid,
                nodes.Block_Stone_Stairs_Dark,
            ];
            break;
        case 'BlockStoneStairsCorner':
            parts = [
                nodes.Block_Stone_Stairs_Corner_Large,
                nodes.Block_Stone_Stairs_Corner_Mid,
                nodes.Block_Stone_Stairs_Corner_Dark,
            ];
            break;
        case 'BlockPolishedStone':
            parts = [nodes.Block_Polished_Stone];
            break;
        case 'BlockPolishedStoneAngle':
            parts = [nodes.Block_Polished_Stone_Angle];
            break;
        case 'BlockPolishedStoneStairs':
            parts = [nodes.Block_Polished_Stone_Stairs];
            break;
        case 'BlockPolishedStoneStairsCorner':
            parts = [nodes.Block_Polished_Stone_Stairs_Corner];
            break;
        default:
            parts = [
                nodes.Block_Stone_Large,
                nodes.Block_Stone_Mid,
                nodes.Block_Stone_Dark,
            ];
            break;
    }

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            {parts.map((node) => (
                <WeatheredEntityPart
                    key={node.name}
                    material={node.material}
                    node={node}
                    rain={stoneRain}
                    snow={snowPresets.stone}
                />
            ))}
        </animated.group>
    );
}
