import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function GardenScarecrow({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('GardenScarecrow');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const parts = [
        nodes.GardenScarecrow_Timber,
        nodes.GardenScarecrow_Straw,
        nodes.GardenScarecrow_Linen,
        nodes.GardenScarecrow_Shirt,
        nodes.GardenScarecrow_Patch,
        nodes.GardenScarecrow_Face,
    ];

    return (
        <animated.group
            name={`GardenScarecrow:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {parts.map((node) => (
                <WeatheredEntityPart
                    key={node.name}
                    node={node}
                    material={node.material}
                    snow={
                        node === nodes.GardenScarecrow_Face
                            ? false
                            : {
                                  maxThickness: 0.018,
                                  coverageMultiplier: 0.35,
                              }
                    }
                    rain={{ glossiness: 0.2 }}
                />
            ))}
        </animated.group>
    );
}
