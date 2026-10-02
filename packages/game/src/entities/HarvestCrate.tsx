import { getHarvestCrate } from '@gredice/js/harvestCrates';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function HarvestCrate({ stack, block, rotation }: EntityInstanceProps) {
    const config = getHarvestCrate(block.name);
    const asset = config?.name ?? 'HarvestCrate';
    const { nodes } = useGameGLTF(asset);
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    if (!config) return null;
    const parts = [
        nodes[`${asset}_Timber`],
        nodes[`${asset}_Frame`],
        nodes[`${asset}_ProducePrimary`],
        nodes[`${asset}_ProduceSecondary`],
        nodes[`${asset}_Stems`],
    ];

    return (
        <animated.group
            name={`HarvestCrate:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {parts.map((node) => (
                <WeatheredEntityPart
                    key={node.name}
                    node={node}
                    material={node.material}
                    snow={{ maxThickness: 0.018, coverageMultiplier: 0.35 }}
                    rain={{ glossiness: 0.25 }}
                />
            ))}
        </animated.group>
    );
}
