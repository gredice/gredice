import { animated } from '@react-spring/three';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function Snowman({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1.139)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Snowman.geometry}
                scale={0.36}
            >
                <meshStandardMaterial
                    color={'#FFFFFF'}
                    roughness={1}
                    metalness={0}
                />
            </mesh>
        </animated.group>
    );
}
