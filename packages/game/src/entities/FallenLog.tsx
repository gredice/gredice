import { fallenLog } from '@gredice/js/fallenLog';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function FallenLog({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('FallenLog');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    const span = getGardenBlockSpan(fallenLog, rotation);
    const position = stack.position.clone().setY(height);
    // Center the authored timber inside the footprint growing in positive grid coordinates.
    position.x += (span.width - 1) / 2;
    position.z += (span.depth - 1) / 2;
    return (
        <animated.group
            name={`FallenLog:${block.id}`}
            position={position}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {/* Baked vertex colours share one immutable GLTF material across bark, cut ends and moss. */}
            <WeatheredEntityPart
                node={nodes.FallenLog_Timber}
                material={nodes.FallenLog_Timber.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.018, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.15 }}
            />
        </animated.group>
    );
}
