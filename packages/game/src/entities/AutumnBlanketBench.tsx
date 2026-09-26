import { autumnBlanketBench } from '@gredice/js/autumnBlanketBench';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function AutumnBlanketBench({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('AutumnBlanketBench');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    const span = getGardenBlockSpan(autumnBlanketBench, rotation);
    const position = stack.position.clone().setY(height);
    // Center the authored timber inside the footprint growing in positive grid coordinates.
    position.x += (span.width - 1) / 2;
    position.z += (span.depth - 1) / 2;
    return (
        <animated.group
            name={`AutumnBlanketBench:${block.id}`}
            position={position}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <WeatheredEntityPart
                node={nodes.AutumnBlanketBench_Timber}
                material={nodes.AutumnBlanketBench_Timber.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.018, coverageMultiplier: 0.4 }
                }
                rain={disabled ? false : { glossiness: 0.25 }}
            />
            <WeatheredEntityPart
                node={nodes.AutumnBlanketBench_Textile}
                material={nodes.AutumnBlanketBench_Textile.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.008, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.03 }}
            />
        </animated.group>
    );
}
