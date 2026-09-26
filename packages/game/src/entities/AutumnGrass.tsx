import {
    autumnGrassSelectionAnchors,
    autumnGrassWind,
    getAutumnGrass,
} from '@gredice/js/autumnGrasses';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function AutumnGrass({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const modelName = getAutumnGrass(block.name)?.name ?? 'AutumnGrassTuft';
    const { nodes } = useGameGLTF(modelName);
    const node =
        modelName === 'AutumnGrassTuft'
            ? nodes.AutumnGrassTuft_Foliage
            : nodes.AutumnSeedHeads_Foliage;
    const base =
        modelName === 'AutumnGrassTuft'
            ? nodes.AutumnGrassTuft_Base
            : nodes.AutumnSeedHeads_Base;
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    return (
        <animated.group
            name={`AutumnGrass:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <group
                name={`AutumnGrass:selection:${block.id}`}
                position={autumnGrassSelectionAnchors[modelName]}
            />
            {autumnGrassWind.roots.map((position, index) => (
                <group
                    key={`${position[0]}:${position[2]}`}
                    name={`AutumnGrass:wind-root:${index}:${block.id}`}
                    position={position}
                />
            ))}
            <WeatheredEntityPart
                node={base}
                material={base.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.008, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.1 }}
            />
            <group
                name={`AutumnGrass:wind-foliage:${block.id}`}
                userData={{ role: 'ornamental-grass', ...autumnGrassWind }}
            >
                <WeatheredEntityPart
                    node={node}
                    material={node.material}
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
