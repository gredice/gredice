import {
    chestnutRoastingCart,
    chestnutRoastingCartEffectAnchors,
} from '@gredice/js/chestnutRoastingCart';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function ChestnutRoastingCart({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('ChestnutRoastingCart');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    const span = getGardenBlockSpan(chestnutRoastingCart, rotation);
    const position = stack.position.clone().setY(height);
    // Center the authored timber inside the footprint growing in positive grid coordinates.
    position.x += (span.width - 1) / 2;
    position.z += (span.depth - 1) / 2;
    return (
        <animated.group
            name={`ChestnutRoastingCart:${block.id}`}
            position={position}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {chestnutRoastingCartEffectAnchors.map((anchor) => (
                <group
                    key={anchor.id}
                    name={`ChestnutRoastingCart:${anchor.id}:${block.id}`}
                    position={anchor.position}
                />
            ))}
            <WeatheredEntityPart
                node={nodes.ChestnutRoastingCart_Cart}
                material={nodes.ChestnutRoastingCart_Cart.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.018, coverageMultiplier: 0.4 }
                }
                rain={disabled ? false : { glossiness: 0.25 }}
            />
            <WeatheredEntityPart
                node={nodes.ChestnutRoastingCart_Roaster}
                material={nodes.ChestnutRoastingCart_Roaster.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.008, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.3 }}
            />
        </animated.group>
    );
}
