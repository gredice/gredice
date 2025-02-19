import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { stackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";

export function StoneLarge({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    return (
        /* @ts-ignore */
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block))}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Stone_Large`].geometry}
                material={materials['Material.Stone']}
                scale={[0.263, 0.426, 0.291]}
            />
            {/* @ts-ignore */}
        </animated.group>
    );
}