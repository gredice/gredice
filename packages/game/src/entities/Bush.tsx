import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { stackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";

export function Bush({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    return (
        /* @ts-ignore */
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block))}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={[0.5, 0.5, 0.5]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Bush_1_1.geometry}
                material={materials['Material.Leaves']}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Bush_1_2.geometry}
                material={materials['Material.GrassPart']}
            />
            {/* @ts-ignore */}
        </animated.group>
    );
}