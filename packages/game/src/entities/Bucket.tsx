import { animated } from '@react-spring/three';
import { MeshDistortMaterial } from '@react-three/drei';
import { models } from '../data/models';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function Bucket({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            scale={[0.3, 0.25, 0.3]}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Bucket_1.geometry}
                material={materials['Material.Water']}
            >
                <MeshDistortMaterial
                    {...materials['Material.Water']}
                    distort={0.2}
                    speed={2}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Bucket_2.geometry}
                material={materials['Material.Metal']}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Bucket_3.geometry}
                material={materials['Material.Planks']}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes['Bucket_-_Handle'].geometry}
                material={nodes['Bucket_-_Handle'].material}
                scale={[3.333, 4, 3.333]}
            />
        </animated.group>
    );
}