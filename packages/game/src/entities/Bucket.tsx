import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { stackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";

export function Bucket({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    return (
        /* @ts-ignore */
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block) + 0.33)}
            scale={[0.4, 0.33, 0.4]}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Bucket_1`].geometry}
                material={materials['Material.Water']}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Bucket_2`].geometry}
                material={materials['Material.Metal']}
            />
            {/* @ts-ignore */}
        </animated.group>
    );
}