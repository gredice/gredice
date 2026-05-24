import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function ShovelSmall({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('ShovelSmall');
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
                <RainWetOverlay
                    geometry={nodes.Shovel_Small.geometry}
                    topSurfaceBias={2.8}
                    darkness={0.8}
                    glossiness={0.9}
                />
            </mesh>
        </animated.group>
    );
}
