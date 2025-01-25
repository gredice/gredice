import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { stackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";
import { Outlines } from "@react-three/drei";
import { useHoveredBlockStore } from "../controls/SelectableGroup";

function HoverOutline({ hovered }: { hovered?: boolean }) {
    if (!hovered) return null;

    return (
        <Outlines thickness={3} color="white" />
    );
}

export function RaisedBedContruction({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const hovered = useHoveredBlockStore(state => state.hoveredBlock) === block;

    return (
        /* @ts-ignore */
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block))}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Raised_Bed_I_Construction_1`].geometry}
                material={materials['Material.Dirt']}
            >
                <HoverOutline hovered={hovered} />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Raised_Bed_I_Construction_2`].geometry}
                material={materials['Material.Planks']}
            >
                <HoverOutline hovered={hovered} />
            </mesh>
            {/* @ts-ignore */}
        </animated.group>
    );
}