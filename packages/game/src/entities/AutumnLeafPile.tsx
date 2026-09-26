import {
    autumnLeafPileInteractionAnchors,
    getAutumnLeafPile,
} from '@gredice/js/autumnLeafPiles';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function AutumnLeafPile({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const modelName =
        getAutumnLeafPile(block.name)?.name ?? 'AutumnLeafPileMound';
    const { nodes } = useGameGLTF(modelName);
    const node =
        modelName === 'AutumnLeafPileMound'
            ? nodes.AutumnLeafPileMound_Leaves
            : nodes.AutumnLeafPileCrescent_Leaves;
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    return (
        <animated.group
            name={`AutumnLeafPile:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <group
                name={`AutumnLeafPile:rake-anchor:${block.id}`}
                position={autumnLeafPileInteractionAnchors[modelName]}
            />
            {/* Owned geometry persists independently of the seasonal ambient leaf system. */}
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
