import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';
import { WindWeatheredEntityPart } from './helpers/WindWeatheredEntityPart';

export function GardenScarecrow({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    const { nodes } = useGameGLTF('GardenScarecrow');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const parts = [
        nodes.GardenScarecrow_Timber,
        nodes.GardenScarecrow_Straw,
        nodes.GardenScarecrow_Linen,
        nodes.GardenScarecrow_Shirt,
        nodes.GardenScarecrow_Face,
    ];

    return (
        <animated.group
            name={`GardenScarecrow:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <WindWeatheredEntityPart
                node={nodes.GardenScarecrow_Patch}
                windRole="scarf"
                seed={block.id}
                disabled={Boolean(disabled)}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.018, coverageMultiplier: 0.35 }
                }
                rain={disabled ? false : { glossiness: 0.2 }}
            />
            {parts.map((node) => (
                <WeatheredEntityPart
                    key={node.name}
                    node={node}
                    material={node.material}
                    snow={
                        disabled || node === nodes.GardenScarecrow_Face
                            ? false
                            : {
                                  maxThickness: 0.018,
                                  coverageMultiplier: 0.35,
                              }
                    }
                    rain={disabled ? false : { glossiness: 0.2 }}
                />
            ))}
        </animated.group>
    );
}
