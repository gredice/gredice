import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function PineAdvent({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={[0.09, 1, 0.09]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tree_2.geometry}
                material={materials['Material.ColorPaletteMain']}
            >
                <SnowOverlay
                    geometry={nodes.Tree_2.geometry}
                    overrideSnow={0.5}
                    {...snowPresets.pine}
                />
            </mesh>
        </animated.group>
    );
}
