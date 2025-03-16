import { animated } from "@react-spring/three";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { useStackHeight } from "../utils/getStackHeight";
import { useGameGLTF } from "../utils/useGameGLTF";
import { useAnimatedEntityRotation } from "./helpers/useAnimatedEntityRotation";
import { models } from "../data/models";

export function Composter({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials }: any = useGameGLTF(models.GameAssets.url);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Composter_1.geometry}
                material={materials['Material.Dirt']}
            />
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Composter_2.geometry}
                material={materials['Material.Planks']}
            />
        </animated.group>
    );
}