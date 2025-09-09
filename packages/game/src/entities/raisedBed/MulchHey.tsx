import { animated } from '@react-spring/three';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useAnimatedEntityRotation } from '../helpers/useAnimatedEntityRotation';

export function MulchHey({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
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
                scale={3}
                geometry={nodes.Mulch_Hey.geometry}
                material={materials['Material.ColorPaletteMain']}
            />
        </animated.group>
    );
}
