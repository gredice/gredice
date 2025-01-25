import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { stackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { getEntityNeighbors } from "./helpers/getEntityNeighbors";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";

export function Shade({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);

    let variant = "Solo";
    let realizedRotation = rotation % 2;
    const neighbors = getEntityNeighbors(stack, block);
    const nInline = neighbors.n && realizedRotation === 0 && (neighbors.nr % 2) === 0;
    const eInline = neighbors.e && realizedRotation === 1 && (neighbors.er % 2) === 1;
    const wInline = neighbors.w && realizedRotation === 1 && (neighbors.wr % 2) === 1;
    const sInline = neighbors.s && realizedRotation === 0 && (neighbors.sr % 2) === 0;
    if (neighbors.total >= 2 && ((nInline && sInline) || (eInline && wInline))) {
        variant = "Middle";
    } else if (nInline || eInline) {
        variant = "End_Left";
    } else if (wInline || sInline) {
        variant = "End_Right";
    }

    const [animatedRotation] = useAnimatedEntityRotation(realizedRotation);

    return (
        /* @ts-ignore */
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block) + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Shade_${variant}`].geometry}
                material={materials['Material.Planks']}
            />
            {/* @ts-ignore */}
        </animated.group>
    );
}