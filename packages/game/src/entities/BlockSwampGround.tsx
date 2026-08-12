import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { BlockSurfaceDecorationSprites } from './groundDecorations/BlockSurfaceDecorationSprites';
import { useGroundPatchStandardMaterial } from './helpers/groundPatchMaterial';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { swampGroundBaseColor } from './swampGroundPalette';

export function BlockSwampGround({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockSand');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const material = useGroundPatchStandardMaterial({
        color: swampGroundBaseColor,
        metalness: 0,
        roughness: 1,
        surface: 'swampDirt',
    });

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_1.geometry}
                material={material}
            />
            <RainWetOverlay geometry={nodes.Block_Sand_1.geometry} />
            <SnowOverlay
                geometry={nodes.Block_Sand_1.geometry}
                {...snowPresets.sand}
            />
            <BlockSurfaceDecorationSprites block={block} surface="swamp" />
        </animated.group>
    );
}
