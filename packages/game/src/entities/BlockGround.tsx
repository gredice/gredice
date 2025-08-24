import { animated } from '@react-spring/three';
import { models } from '../data/models';
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
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    const variantResolved = (variant ?? 1) % 2;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Ground_${variantResolved}_1`].geometry}
                material={nodes[`Block_Ground_${variantResolved}_1`].material}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Ground_${variantResolved}_2`].geometry}
                material={materials['Material.Stone']}
            />
        </animated.group>
    );
}