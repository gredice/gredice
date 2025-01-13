import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { stackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";

export function RaisedBedContruction({ stack, block, rotation }: EntityInstanceProps) {
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
                geometry={nodes[`Raised_Bed_I_Construction_1`].geometry}
                material={materials['Material.Dirt']}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes[`Raised_Bed_I_Construction_2`].geometry}
                material={materials['Material.Planks']}
            />
            {/* @ts-ignore */}
        </animated.group>
    );
}