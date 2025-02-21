import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { stackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";

export function Tree({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    return (
        /* @ts-ignore */
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block) + 0.2)}
            scale={[0.05, 0.2, 0.05]}
            rotation={animatedRotation as unknown as [number, number, number]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Tree_1_1.geometry}
          material={materials['Material.Planks']}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Tree_1_2.geometry}
          material={materials['Material.Leaves']}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Tree_1_3.geometry}
          material={materials['Material.GrassPart']}
        />
            {/* @ts-ignore */}
        </animated.group>
    );
}