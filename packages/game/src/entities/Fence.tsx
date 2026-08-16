import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import type { FenceConnectionShape } from './fenceConnections';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { useFenceConnectionState } from './helpers/useFenceConnectionState';

export const fenceVariantNames = {
    Solo: 'Fence_Solo',
    Single: 'Fence_Single',
    Middle: 'Fence_Middle',
    Corner: 'Fence_Corner',
    T: 'Fence_T',
    Cross: 'Fence_Cross',
} satisfies Record<
    FenceConnectionShape,
    keyof ReturnType<typeof useGameGLTF>['nodes']
>;
export const fenceExtensionName = 'Fence_Extension' satisfies keyof ReturnType<
    typeof useGameGLTF
>['nodes'];

export function Fence({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('Fence');
    const currentStackHeight = useStackHeight(stack, block);

    const { connection, extensionRotations } = useFenceConnectionState(
        stack,
        block,
        rotation,
    );
    const variant = fenceVariantNames[connection.shape];
    const [animatedRotation] = useAnimatedEntityRotation(connection.rotation);

    return (
        <>
            <animated.group
                position={stack.position.clone().setY(currentStackHeight + 1)}
                rotation={
                    animatedRotation as unknown as [number, number, number]
                }
            >
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[variant].geometry}
                    material={materials['Material.Planks']}
                >
                    <SnowOverlay
                        geometry={nodes[variant].geometry}
                        maxThickness={0.09}
                        slopeExponent={2.9}
                        noiseScale={3.3}
                    />
                    <RainWetOverlay geometry={nodes[variant].geometry} />
                </mesh>
            </animated.group>
            {extensionRotations.map((extensionRotation) => (
                <group
                    key={extensionRotation}
                    position={stack.position
                        .clone()
                        .setY(currentStackHeight + 1)}
                    rotation={[0, extensionRotation * (Math.PI / 2), 0]}
                >
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes[fenceExtensionName].geometry}
                        material={materials['Material.Planks']}
                    >
                        <SnowOverlay
                            geometry={nodes[fenceExtensionName].geometry}
                            maxThickness={0.09}
                            slopeExponent={2.9}
                            noiseScale={3.3}
                        />
                        <RainWetOverlay
                            geometry={nodes[fenceExtensionName].geometry}
                        />
                    </mesh>
                </group>
            ))}
        </>
    );
}
