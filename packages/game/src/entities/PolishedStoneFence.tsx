import { animated } from '@react-spring/three';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    type FenceConnectionShape,
    resolveFenceConnection,
} from './fenceConnections';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { useEntityNeighbors } from './helpers/useEntityNeighbors';

export const polishedStoneFenceVariantNames = {
    Solo: 'PolishedStoneFence_Solo',
    Single: 'PolishedStoneFence_Single',
    Middle: 'PolishedStoneFence_Middle',
    Corner: 'PolishedStoneFence_Corner',
    T: 'PolishedStoneFence_T',
    Cross: 'PolishedStoneFence_Cross',
} satisfies Record<
    FenceConnectionShape,
    keyof ReturnType<typeof useGameGLTF>['nodes']
>;

export function PolishedStoneFence({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('PolishedStoneFence');
    const currentStackHeight = useStackHeight(stack, block);
    const neighbors = useEntityNeighbors(stack, block);
    const connection = resolveFenceConnection(neighbors, rotation);
    const variant = polishedStoneFenceVariantNames[connection.shape];
    const [animatedRotation] = useAnimatedEntityRotation(connection.rotation);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[variant].geometry}
                material={materials['Material.PolishedStoneFence.Surface']}
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
    );
}
