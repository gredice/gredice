import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useGroundPatchMaterial } from './helpers/groundPatchMaterial';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BlockGroundAngle({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockGroundAngle');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    const variantResolved1: 'Block_Ground_Angle_1' = 'Block_Ground_Angle_1';
    const groundMaterial1 = useGroundPatchMaterial(
        nodes[variantResolved1].material,
        'dirt',
    );

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[variantResolved1].geometry}
                material={groundMaterial1}
            />
            <SnowOverlay
                geometry={nodes[variantResolved1].geometry}
                maxThickness={0.18}
                slopeExponent={2.2}
                noiseScale={1.8}
            />
        </animated.group>
    );
}
