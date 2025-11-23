import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BlockGrass({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    // const hovered = useHoveredBlockStore(state => state.hoveredBlock) === block;

    const variantResolved = 1;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Grass_${variantResolved}_2`].geometry}
                material={materials[`Material.Grass`]}
            />
            <SnowOverlay
                geometry={nodes[`Block_Grass_${variantResolved}_2`].geometry}
                {...snowPresets.grassFlat}
            />
        </animated.group>
    );
}
