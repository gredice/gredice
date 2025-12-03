import { animated } from '@react-spring/three';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function Composter({ stack, block, rotation }: EntityInstanceProps) {
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
                geometry={nodes.Composter_1.geometry}
                material={materials['Material.Dirt']}
            >
                <SnowOverlay
                    geometry={nodes.Composter_1.geometry}
                    maxThickness={0.18}
                    slopeExponent={2.6}
                    noiseScale={2.4}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Composter_2.geometry}
                material={materials['Material.Planks']}
            >
                <SnowOverlay
                    geometry={nodes.Composter_2.geometry}
                    maxThickness={0.12}
                    slopeExponent={2.8}
                    noiseScale={3}
                />
            </mesh>
        </animated.group>
    );
}
