import { animated } from '@react-spring/three';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useAnimatedEntityRotation } from '../helpers/useAnimatedEntityRotation';

export function Seed({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF();
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
                geometry={nodes.Seed.geometry}
                material={nodes.Seed.material}
            />
        </animated.group>
    );
}
