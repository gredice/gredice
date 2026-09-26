import { getHalloweenAccent } from '@gredice/js/halloweenAccents';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function HalloweenAccent({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const name = getHalloweenAccent(block.name)?.name ?? 'FriendlyGhost';
    const { nodes } = useGameGLTF(name);
    const node =
        name === 'FriendlyGhost'
            ? nodes.FriendlyGhost_Arrangement
            : nodes.SupportedCobweb_Arrangement;
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    return (
        <animated.group
            name={`HalloweenAccent:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <WeatheredEntityPart
                node={node}
                material={node.material}
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
