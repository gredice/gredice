import { getAutumnAsterPot } from '@gredice/js/autumnAsterPots';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function AutumnAsterPot({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const config = getAutumnAsterPot(block.name);
    const { nodes } = useGameGLTF('AutumnAsterPot');
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    if (!config) return null;
    return (
        <animated.group
            name={`AutumnAsterPot:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {[
                nodes.AutumnAsterPot_Pot,
                nodes.AutumnAsterPot_Soil,
                nodes.AutumnAsterPot_Foliage,
            ].map((node) => (
                <WeatheredEntityPart
                    key={node.name}
                    node={node}
                    material={node.material}
                    snow={{ maxThickness: 0.015, coverageMultiplier: 0.3 }}
                    rain={{ glossiness: 0.2 }}
                />
            ))}
            {/* R3F owns these per-instance materials; the cached GLB is never recoloured. */}
            <WeatheredEntityPart
                node={nodes.AutumnAsterPot_Petals}
                snow={{ maxThickness: 0.008, coverageMultiplier: 0.2 }}
                rain={{ glossiness: 0.15 }}
            >
                <meshStandardMaterial
                    color={config.color}
                    roughness={0.95}
                    metalness={0}
                />
            </WeatheredEntityPart>
            <WeatheredEntityPart
                node={nodes.AutumnAsterPot_Centers}
                snow={{ maxThickness: 0.008, coverageMultiplier: 0.2 }}
                rain={{ glossiness: 0.15 }}
            >
                <meshStandardMaterial
                    color={config.centerColor}
                    roughness={0.95}
                    metalness={0}
                />
            </WeatheredEntityPart>
        </animated.group>
    );
}
