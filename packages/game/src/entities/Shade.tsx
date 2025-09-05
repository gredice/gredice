import { animated } from '@react-spring/three';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { useEntityNeighbors } from './helpers/useEntityNeighbors';

export function Shade({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const currentStackHeight = useStackHeight(stack, block);

    let realizedRotation = rotation % 2;

    let solo = false;
    let left = false;
    let right = false;
    let n = false;
    let e = false;
    let w = false;
    let s = false;
    let middle = false;

    const neighbors = useEntityNeighbors(stack, block);
    if (neighbors.total === 1) {
        if (neighbors.n) {
            left = true;
            if (realizedRotation % 2 === 0) {
                s = true;
            } else {
                right = true;
                w = true;
                middle = true;
            }
        } else if (neighbors.e) {
            left = true;
            if (realizedRotation % 2 === 1) {
                s = true;
            } else {
                right = true;
                e = true;
                middle = true;
            }
        } else if (neighbors.s) {
            right = true;
            if (realizedRotation % 2 === 0) {
                n = true;
            } else {
                left = true;
                e = true;
                middle = true;
            }
        } else if (neighbors.w) {
            right = true;
            if (realizedRotation % 2 === 1) {
                n = true;
            } else {
                left = true;
                w = true;
                middle = true;
            }
        }
    } else if (neighbors.total >= 2) {
        let sides = 0;

        if (neighbors.n) {
            s = true;
            sides++;
        }
        if (neighbors.w) {
            w = true;
            sides++;
        }
        if (neighbors.e) {
            e = true;
            sides++;
        }
        if (neighbors.s) {
            n = true;
            sides++;
        }

        if (sides === 2 && ((s && e) || (n && w) || (n && e) || (s && w))) {
            middle = true;
        } else if (sides >= 3) {
            middle = true;
        }

        realizedRotation = 0;
    }

    if (!left && !right && !n && !s && !e && !w && !middle) {
        solo = true;
    }

    const [animatedRotation] = useAnimatedEntityRotation(realizedRotation);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            {solo && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Shade_Solo.geometry}
                    material={materials['Material.Planks']}
                />
            )}
            {left && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Shade_Single_Left.geometry}
                    material={materials['Material.Planks']}
                />
            )}
            {right && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Shade_Single_Right.geometry}
                    material={materials['Material.Planks']}
                />
            )}
            {n && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Shade_N.geometry}
                    material={materials['Material.Planks']}
                />
            )}
            {e && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Shade_E.geometry}
                    material={materials['Material.Planks']}
                />
            )}
            {w && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Shade_W.geometry}
                    material={materials['Material.Planks']}
                />
            )}
            {s && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Shade_S.geometry}
                    material={materials['Material.Planks']}
                />
            )}
            {middle && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Shade_Middle.geometry}
                    material={materials['Material.Planks']}
                />
            )}
        </animated.group>
    );
}
