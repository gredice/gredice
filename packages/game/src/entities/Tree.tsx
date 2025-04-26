import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { useStackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";
import { MeshDistortMaterial, MeshWobbleMaterial } from "@react-three/drei";
import { useHoveredBlockStore } from "../controls/useHoveredBlockStore";
import { HoverOutline } from "./helpers/HoverOutline";

export function Tree({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const hovered = useHoveredBlockStore(state => state.hoveredBlock) === block;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.5)}
            scale={[0.125, 0.5, 0.125]}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tree_1_1.geometry}
                material={materials['Material.Planks']}
            >
                <HoverOutline hovered={hovered} variant="outlines" />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tree_1_2.geometry}
            >
                <MeshDistortMaterial {...materials['Material.Leaves']} distort={0.1} speed={2} />
                <HoverOutline hovered={hovered} variant="outlines" />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tree_1_3.geometry}
            >
                <MeshWobbleMaterial {...materials['Material.GrassPart']} factor={0.02} speed={2} />
            </mesh>
        </animated.group>
    );
}