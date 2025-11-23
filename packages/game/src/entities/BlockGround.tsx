import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BlockGround({
    stack,
    block,
    rotation,
    variant,
}: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    const variantResolved1: 'Block_Ground_1_1' | 'Block_Ground_2_1' =
        (variant ?? 1) % 2 ? 'Block_Ground_1_1' : 'Block_Ground_2_1';
    const variantResolved2: 'Block_Ground_1_2' | 'Block_Ground_2_2' =
        (variant ?? 1) % 2 ? 'Block_Ground_1_2' : 'Block_Ground_2_2';

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[variantResolved1].geometry}
                material={nodes[variantResolved1].material}
            />
            <SnowOverlay
                geometry={nodes[variantResolved1].geometry}
                maxThickness={0.22}
                slopeExponent={3.2}
                noiseScale={1.7}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[variantResolved2].geometry}
                material={materials['Material.Stone']}
            />
        </animated.group>
    );
}
