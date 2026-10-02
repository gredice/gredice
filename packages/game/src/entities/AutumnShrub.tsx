import { useAutumnState } from '../hooks/useAutumnState';
import { useSeasonState } from '../hooks/useSeasonState';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { getAutumnShrubAppearance } from './autumnShrubAppearance';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function AutumnShrub({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('AutumnShrub');
    const autumn = useAutumnState();
    const season = useSeasonState();
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = Boolean(weatherDisabled || globallyDisabled);
    const { stage, gold, russet } = getAutumnShrubAppearance({
        autumn,
        season: season.season,
        blockId: block.id,
        disabled,
    });
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const foliage =
        stage === 'full'
            ? [nodes.AutumnShrub_FullGold, nodes.AutumnShrub_FullRusset]
            : stage === 'thinning'
              ? [
                    nodes.AutumnShrub_ThinningGold,
                    nodes.AutumnShrub_ThinningRusset,
                ]
              : stage === 'sparse'
                ? [nodes.AutumnShrub_SparseGold, nodes.AutumnShrub_SparseRusset]
                : [];
    const snow = disabled
        ? false
        : { maxThickness: 0.025, coverageMultiplier: 0.45 };
    const rain = disabled ? false : { glossiness: 0.2 };
    return (
        <animated.group
            name={`AutumnShrub:${block.id}`}
            userData={{ canopyStage: stage }}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <WeatheredEntityPart
                node={nodes.AutumnShrub_Wood}
                material={nodes.AutumnShrub_Wood.material}
                snow={snow}
                rain={rain}
            />
            {foliage.map((node, index) => (
                <WeatheredEntityPart
                    key={node.name}
                    node={node}
                    snow={snow}
                    rain={rain}
                >
                    {/* Per-instance owned materials: no cached GLTF colour or geometry mutation. */}
                    <meshStandardMaterial
                        color={index === 0 ? gold : russet}
                        roughness={0.95}
                        metalness={0}
                    />
                </WeatheredEntityPart>
            ))}
        </animated.group>
    );
}
