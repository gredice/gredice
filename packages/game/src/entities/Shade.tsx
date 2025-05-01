import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { useStackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useEntityNeighbors } from "./helpers/useEntityNeighbors";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";
import { useHoveredBlockStore } from "../controls/useHoveredBlockStore";
import { HoverOutline } from "./helpers/HoverOutline";

export function Shade({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const currentStackHeight = useStackHeight(stack, block);
    const hovered = useHoveredBlockStore().hoveredBlock === block;

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

        if (sides === 2 && (s && e || n && w || n && e || s && w)) {
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

    let nodeName = "Solo";
    if (left) {
        nodeName = "Single_Left";
    } else if (right) {
        nodeName = "Single_Right";
    } else if (n) {
        nodeName = "N";
    } else if (e) {
        nodeName = "E";
    } else if (w) {
        nodeName = "W";
    } else if (s) {
        nodeName = "S";
    } else if (middle) {
        nodeName = "Middle";
    }

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Shade_${nodeName}`].geometry}
                material={materials['Material.Planks']}
            >
                <HoverOutline hovered={hovered} />
            </mesh>
        </animated.group>
    );
}