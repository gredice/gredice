import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import type { FenceConnectionShape } from './fenceConnections';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { useFenceConnectionState } from './helpers/useFenceConnectionState';

export const whiteFenceVariantNames = {
    Solo: 'WhiteFence_Solo',
    Single: 'WhiteFence_Single',
    Middle: 'WhiteFence_Middle',
    Corner: 'WhiteFence_Corner',
    T: 'WhiteFence_T',
    Cross: 'WhiteFence_Cross',
} satisfies Record<
    FenceConnectionShape,
    keyof ReturnType<typeof useGameGLTF>['nodes']
>;
export const whiteFencePoleName = 'WhiteFence_Pole' satisfies keyof ReturnType<
    typeof useGameGLTF
>['nodes'];
export const whiteFenceExtensionName =
    'WhiteFence_Extension' satisfies keyof ReturnType<
        typeof useGameGLTF
    >['nodes'];

export function WhiteFence({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('WhiteFence');
    const currentStackHeight = useStackHeight(stack, block);
    const { connection, extensionRotations, hasAdjacentFence } =
        useFenceConnectionState(stack, block, rotation);
    const variant =
        connection.shape === 'Solo' && hasAdjacentFence
            ? whiteFencePoleName
            : whiteFenceVariantNames[connection.shape];
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
                    material={materials['Material.WhitePaint']}
                >
                    <SnowOverlay
                        geometry={nodes[variant].geometry}
                        maxThickness={0.035}
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
                        geometry={nodes[whiteFenceExtensionName].geometry}
                        material={materials['Material.WhitePaint']}
                    >
                        <SnowOverlay
                            geometry={nodes[whiteFenceExtensionName].geometry}
                            maxThickness={0.035}
                            slopeExponent={2.9}
                            noiseScale={3.3}
                        />
                        <RainWetOverlay
                            geometry={nodes[whiteFenceExtensionName].geometry}
                        />
                    </mesh>
                </group>
            ))}
        </>
    );
}
