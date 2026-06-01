import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../../rain/RainWetOverlay';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './useAnimatedEntityRotation';

const lidClosedRotation = 0;

export function GardenBox({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('GardenBox');
    const [animatedRotation] = useAnimatedEntityRotation(rotation + 2);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.GardenBox_Body_Planks.geometry}
                material={materials['Material.Planks']}
            />
            <SnowOverlay
                geometry={nodes.GardenBox_Body_Planks.geometry}
                {...snowPresets.giftBox}
            />
            <RainWetOverlay geometry={nodes.GardenBox_Body_Planks.geometry} />
            <group
                position={[0, 0.6, -0.38]}
                rotation={[lidClosedRotation, 0, 0]}
            >
                <mesh
                    receiveShadow
                    geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                    material={materials['Material.Planks']}
                />
                <SnowOverlay
                    geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                    {...snowPresets.giftBox}
                />
                <RainWetOverlay
                    geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                />
            </group>
        </animated.group>
    );
}
