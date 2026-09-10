import { animated } from '@react-spring/three';
import { MeshWobbleMaterial } from '@react-three/drei';
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
import { tulipBouquetStems } from './tulipBouquet';

export function Tulip({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('Tulip');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const materialAnimationActive = useTimeDrivenMaterialAnimation();

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            {tulipBouquetStems.map((stem) => (
                <group
                    key={stem.key}
                    position={stem.position}
                    rotation={stem.rotation}
                    scale={stem.scale}
                >
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Tulip.geometry}
                        material={materials['Material.ColorPaletteMain']}
                    >
                        <SnowOverlay
                            geometry={nodes.Tulip.geometry}
                            {...snowPresets.tulip}
                        />
                    </mesh>
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Tulip_Leaves.geometry}
                    >
                        <MeshWobbleMaterial
                            {...materials['Material.GrassPart']}
                            factor={0.015}
                            speed={resolveTimeDrivenMaterialSpeed(
                                2,
                                materialAnimationActive,
                            )}
                        />
                        <SnowOverlay
                            geometry={nodes.Tulip_Leaves.geometry}
                            {...snowPresets.tulip}
                        />
                    </mesh>
                </group>
            ))}
        </animated.group>
    );
}
