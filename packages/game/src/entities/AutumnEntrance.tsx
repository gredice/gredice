import { autumnEntranceSway } from '@gredice/js/autumnEntrances';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';
import { WindWeatheredEntityPart } from './helpers/WindWeatheredEntityPart';

export function AutumnEntrance({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const name =
        block.name === 'AutumnGarland' ? 'AutumnGarland' : 'AutumnWreathPost';
    const { nodes } = useGameGLTF(name);
    const support =
        name === 'AutumnGarland'
            ? nodes.AutumnGarland_Support
            : nodes.AutumnWreathPost_Support;
    const foliage =
        name === 'AutumnGarland'
            ? nodes.AutumnGarland_Foliage
            : nodes.AutumnWreathPost_Foliage;
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    return (
        <animated.group
            name={`AutumnEntrance:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <WeatheredEntityPart
                node={support}
                material={support.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.012, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.12 }}
            />
            {autumnEntranceSway[name].roots.map((position, index) => (
                <group
                    key={position.join(':')}
                    name={`AutumnEntrance:sway:${index}:${block.id}`}
                    position={position}
                />
            ))}
            <group
                name={`AutumnEntrance:foliage:${block.id}`}
                userData={{
                    role: 'autumn-entrance-foliage',
                    ...autumnEntranceSway[name],
                }}
            >
                <WindWeatheredEntityPart
                    node={foliage}
                    windRole={name === 'AutumnGarland' ? 'garland' : 'wreath'}
                    seed={block.id}
                    disabled={Boolean(disabled)}
                    snow={
                        disabled
                            ? false
                            : { maxThickness: 0.008, coverageMultiplier: 0.25 }
                    }
                    rain={disabled ? false : { glossiness: 0.08 }}
                />
            </group>
        </animated.group>
    );
}
