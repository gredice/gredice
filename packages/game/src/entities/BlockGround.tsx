import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { stackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";

export function BlockGround({ stack, block, rotation, variant }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);

    const variantResolved = (variant ?? 1) % 2;

    return (
        /* @ts-ignore */
        <animated.group
            position={stack.position.clone().setY(stackHeight(stack, block) + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Ground_${variantResolved}_1`].geometry}
                material={nodes[`Block_Ground_${variantResolved}_1`].material}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Block_Ground_${variantResolved}_2`].geometry}
                material={materials['Material.Stone']}
            />
            {/* @ts-ignore */}
        </animated.group>
    );
}