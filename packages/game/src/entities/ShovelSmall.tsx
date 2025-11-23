import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function ShovelSmall({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight - 0.1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Shovel_Small.geometry}
                material={materials['Material.ColorPaletteMain']}
            >
                <SnowOverlay
                    geometry={nodes.Shovel_Small.geometry}
                    {...snowPresets.tool}
                />
            </mesh>
        </animated.group>
    );
}
