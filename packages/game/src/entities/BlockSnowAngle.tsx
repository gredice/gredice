import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useGroundPatchStandardMaterial } from './helpers/groundPatchMaterial';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BlockSnowAngle({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockSandAngle');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const snowMaterial = useGroundPatchStandardMaterial({
        color: '#f0f7ff',
        metalness: 0,
        roughness: 1,
        surface: 'snow',
    });

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_Angle_1.geometry}
                material={snowMaterial}
            />
            <SnowOverlay
                geometry={nodes.Block_Sand_Angle_1.geometry}
                {...snowPresets.snowAngle}
            />
        </animated.group>
    );
}
