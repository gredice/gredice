import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { useStackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";
import { Edges } from "@react-three/drei";
import { useHoveredBlockStore } from "../controls/SelectableGroup";

export function HoverOutline({ hovered }: { hovered?: boolean }) {
    if (!hovered) return null;

    return (
        // <Outlines thickness={3} color="white" />
        <Edges
            linewidth={3}
            threshold={60} // Display edges only when the angle between two faces exceeds this value (default=15 degrees)
            color="white"
        />
    );
}

export function RaisedBedContruction({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const hovered = useHoveredBlockStore(state => state.hoveredBlock) === block;
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
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
        </animated.group>
    );
}