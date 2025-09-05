import { animated } from '@react-spring/three';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { useEntityNeighbors } from './helpers/useEntityNeighbors';

export function Fence({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const currentStackHeight = useStackHeight(stack, block);

    let variant:
        | 'Fence_Solo'
        | 'Fence_Single'
        | 'Fence_Middle'
        | 'Fence_Corner'
        | 'Fence_T'
        | 'Fence_Cross' = 'Fence_Solo';
    let realizedRotation = rotation % 4;
    const neighbors = useEntityNeighbors(stack, block);

    // Variant: Solor, Single, Middle, Corner, T, Cross
    if (neighbors.total === 1) {
        variant = 'Fence_Single';
        realizedRotation = neighbors.n
            ? 3
            : neighbors.s
              ? 1
              : neighbors.e
                ? 0
                : 2;
    } else if (neighbors.total === 2) {
        if (neighbors.n && neighbors.s) {
            variant = 'Fence_Middle';
            realizedRotation = 1;
        } else if (neighbors.e && neighbors.w) {
            variant = 'Fence_Middle';
            realizedRotation = 0;
        } else {
            variant = 'Fence_Corner';
            if (neighbors.n && neighbors.e) {
                realizedRotation = 0;
            } else if (neighbors.e && neighbors.s) {
                realizedRotation = 1;
            } else if (neighbors.s && neighbors.w) {
                realizedRotation = 2;
            } else if (neighbors.w && neighbors.n) {
                realizedRotation = 3;
            }
        }
    } else if (neighbors.total === 3) {
        variant = 'Fence_T';
        if (neighbors.n && neighbors.e && neighbors.s) {
            realizedRotation = 0;
        } else if (neighbors.e && neighbors.s && neighbors.w) {
            realizedRotation = 1;
        } else if (neighbors.s && neighbors.w && neighbors.n) {
            realizedRotation = 2;
        } else if (neighbors.w && neighbors.n && neighbors.e) {
            realizedRotation = 3;
        }
    } else if (neighbors.total === 4) {
        variant = 'Fence_Cross';
    }

    const [animatedRotation] = useAnimatedEntityRotation(realizedRotation);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[variant].geometry}
                material={materials['Material.Planks']}
            />
        </animated.group>
    );
}
