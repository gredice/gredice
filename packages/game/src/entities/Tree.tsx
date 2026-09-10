import { animated } from '@react-spring/three';
import { MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    resolveTimeDrivenMaterialSpeed,
    useTimeDrivenMaterialAnimation,
} from './helpers/timeDrivenMaterialAnimation';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function Tree({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('Tree');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const materialAnimationActive = useTimeDrivenMaterialAnimation();

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.5)}
            scale={[0.125, 0.5, 0.125]}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tree_1_1.geometry}
                material={materials['Material.Planks']}
            />
            <mesh castShadow receiveShadow geometry={nodes.Tree_1_2.geometry}>
                <MeshDistortMaterial
                    {...materials['Material.Leaves']}
                    distort={0.1}
                    speed={resolveTimeDrivenMaterialSpeed(
                        2,
                        materialAnimationActive,
                    )}
                />
            </mesh>
            <SnowOverlay
                geometry={nodes.Tree_1_2.geometry}
                {...snowPresets.treeCanopyInner}
                renderOrder={2}
            />
            <mesh castShadow receiveShadow geometry={nodes.Tree_1_3.geometry}>
                <MeshWobbleMaterial
                    {...materials['Material.GrassPart']}
                    factor={0.02}
                    speed={resolveTimeDrivenMaterialSpeed(
                        2,
                        materialAnimationActive,
                    )}
                />
            </mesh>
        </animated.group>
    );
}
