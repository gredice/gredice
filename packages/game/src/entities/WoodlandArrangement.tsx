import {
    getWoodlandArrangement,
    woodlandObservationAnchors,
} from '@gredice/js/woodlandArrangements';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function WoodlandArrangement({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const modelName =
        getWoodlandArrangement(block.name)?.name ?? 'WoodlandAcorns';
    const { nodes } = useGameGLTF(modelName);
    const node =
        modelName === 'WoodlandAcorns'
            ? nodes.WoodlandAcorns_Arrangement
            : modelName === 'WoodlandConkers'
              ? nodes.WoodlandConkers_Arrangement
              : nodes.WoodlandMushroomBasket_Arrangement;
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    return (
        <animated.group
            name={`WoodlandArrangement:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <group
                name={`WoodlandArrangement:observation:${block.id}`}
                position={woodlandObservationAnchors[modelName]}
            />
            <WeatheredEntityPart
                node={node}
                material={node.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.012, coverageMultiplier: 0.35 }
                }
                rain={disabled ? false : { glossiness: 0.15 }}
            />
        </animated.group>
    );
}
