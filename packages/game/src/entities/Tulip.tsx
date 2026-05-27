import { animated } from '@react-spring/three';
import { MeshWobbleMaterial } from '@react-three/drei';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function Tulip({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('Tulip');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tulip.geometry}
                material={materials['Material.ColorPaletteMain']}
            >
                <SnowOverlay
                    geometry={nodes.Tulip.geometry}
                    {...snowPresets.tulip}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tulip_Leaves.geometry}
            >
                <MeshWobbleMaterial
                    {...materials['Material.GrassPart']}
                    factor={0.015}
                    speed={2}
                />
                <SnowOverlay
                    geometry={nodes.Tulip_Leaves.geometry}
                    {...snowPresets.tulip}
                />
            </mesh>
        </animated.group>
    );
}
