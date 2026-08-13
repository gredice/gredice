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

export function WhiteFence({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('WhiteFence');
    const currentStackHeight = useStackHeight(stack, block);
    const neighbors = useEntityNeighbors(stack, block);
    const connection = resolveFenceConnection(neighbors, rotation);
    const variant = whiteFenceVariantNames[connection.shape];
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
    );
}
