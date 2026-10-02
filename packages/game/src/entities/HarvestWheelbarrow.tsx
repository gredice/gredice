import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
import { harvestWheelbarrow } from '@gredice/js/harvestWheelbarrow';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function HarvestWheelbarrow({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('HarvestWheelbarrow');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const span = getGardenBlockSpan(harvestWheelbarrow, rotation);
    const position = stack.position.clone().setY(height);
    // Footprints grow in positive grid coordinates; the authored model is centered.
    position.x += (span.width - 1) / 2;
    position.z += (span.depth - 1) / 2;
    const parts = [
        nodes.HarvestWheelbarrow_Timber,
        nodes.HarvestWheelbarrow_Frame,
        nodes.HarvestWheelbarrow_Hardware,
        nodes.HarvestWheelbarrow_Pumpkins,
        nodes.HarvestWheelbarrow_Cream,
        nodes.HarvestWheelbarrow_Stems,
    ];
    return (
        <animated.group
            name={`HarvestWheelbarrow:${block.id}`}
            position={position}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {parts.map((node) => (
                <WeatheredEntityPart
                    key={node.name}
                    node={node}
                    material={node.material}
                    snow={{ maxThickness: 0.022, coverageMultiplier: 0.4 }}
                    rain={{ glossiness: 0.25 }}
                />
            ))}
        </animated.group>
    );
}
