import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { useStackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";
import { useHoveredBlockStore } from "../controls/useHoveredBlockStore";
import { HoverOutline } from "./helpers/HoverOutline";

export function BlockSand({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const hovered = useHoveredBlockStore().hoveredBlock === block;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Sand`].geometry}
                material={nodes[`Block_Sand`].material}
            >
                <HoverOutline hovered={hovered} />
            </mesh>
        </animated.group>
    );
}