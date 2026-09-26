import { gardenTeaTableMugAnchors } from '@gredice/js/gardenTeaTable';
import { SteamEmitter } from '../scene/SteamEmitter';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function GardenTeaTable({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('GardenTeaTable');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    return (
        <animated.group
            name={`GardenTeaTable:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {gardenTeaTableMugAnchors.map((anchor) => (
                <SteamEmitter
                    key={anchor.id}
                    id={`GardenTeaTable:mug:${anchor.id}:${block.id}`}
                    position={anchor.position}
                    radius={anchor.radius}
                    enabled={!disabled}
                />
            ))}
            <WeatheredEntityPart
                node={nodes.GardenTeaTable_Timber}
                material={nodes.GardenTeaTable_Timber.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.012, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.15 }}
            />{' '}
            <WeatheredEntityPart
                node={nodes.GardenTeaTable_TeaSet}
                material={nodes.GardenTeaTable_TeaSet.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.012, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.3 }}
            />
        </animated.group>
    );
}
