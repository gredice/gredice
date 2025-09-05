import { animated } from '@react-spring/three';
import { MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function Bush({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={[0.5, 0.5, 0.5]}
        >
            <mesh castShadow receiveShadow geometry={nodes.Bush_1_1.geometry}>
                <MeshDistortMaterial
                    {...materials['Material.Leaves']}
                    distort={0.1}
                    speed={2}
                />
            </mesh>
            <mesh castShadow receiveShadow geometry={nodes.Bush_1_2.geometry}>
                <MeshWobbleMaterial
                    {...materials['Material.GrassPart']}
                    factor={0.02}
                    speed={3}
                />
            </mesh>
        </animated.group>
    );
}
