import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function WoodlandMushrooms({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('WoodlandMushrooms');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    return (
        <animated.group
            name={`WoodlandMushrooms:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {/* Baked vertex colours share one immutable GLTF material across all five mushrooms. */}
            <WeatheredEntityPart
                node={nodes.WoodlandMushrooms_Cluster}
                material={nodes.WoodlandMushrooms_Cluster.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.012, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.15 }}
            />
        </animated.group>
    );
}
