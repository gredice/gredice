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

export const stoneFenceVariantNames = {
    Solo: [
        'StoneFence_Solo_Mesh',
        'StoneFence_Solo_Mesh_1',
        'StoneFence_Solo_Mesh_2',
    ],
    Single: [
        'StoneFence_Single_Mesh',
        'StoneFence_Single_Mesh_1',
        'StoneFence_Single_Mesh_2',
    ],
    Middle: [
        'StoneFence_Middle_Mesh',
        'StoneFence_Middle_Mesh_1',
        'StoneFence_Middle_Mesh_2',
    ],
    Corner: [
        'StoneFence_Corner_Mesh',
        'StoneFence_Corner_Mesh_1',
        'StoneFence_Corner_Mesh_2',
    ],
    T: ['StoneFence_T_Mesh', 'StoneFence_T_Mesh_1', 'StoneFence_T_Mesh_2'],
    Cross: [
        'StoneFence_Cross_Mesh',
        'StoneFence_Cross_Mesh_1',
        'StoneFence_Cross_Mesh_2',
    ],
} satisfies Record<
    FenceConnectionShape,
    readonly (keyof ReturnType<typeof useGameGLTF>['nodes'])[]
>;

export function StoneFence({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('StoneFence');
    const currentStackHeight = useStackHeight(stack, block);
    const neighbors = useEntityNeighbors(stack, block);
    const connection = resolveFenceConnection(neighbors, rotation);
    const variantNodeNames = stoneFenceVariantNames[connection.shape];
    const [animatedRotation] = useAnimatedEntityRotation(connection.rotation);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            {variantNodeNames.map((nodeName) => {
                const node = nodes[nodeName];
                return (
                    <mesh
                        key={nodeName}
                        castShadow
                        receiveShadow
                        geometry={node.geometry}
                        material={node.material}
                    >
                        <SnowOverlay
                            geometry={node.geometry}
                            maxThickness={0.05}
                            slopeExponent={2.9}
                            noiseScale={3.3}
                        />
                        <RainWetOverlay geometry={node.geometry} />
                    </mesh>
                );
            })}
        </animated.group>
    );
}
