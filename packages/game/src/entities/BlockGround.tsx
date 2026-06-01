import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useGroundPatchMaterial } from './helpers/groundPatchMaterial';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BlockGround({
    stack,
    block,
    rotation,
    variant,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockGround');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    const variantResolved1: 'Block_Ground_1' | 'Block_Ground_2' =
        (variant ?? 1) % 2 ? 'Block_Ground_1' : 'Block_Ground_2';
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
                maxThickness={0.22}
                slopeExponent={3.2}
                noiseScale={1.7}
            />
        </animated.group>
    );
}
