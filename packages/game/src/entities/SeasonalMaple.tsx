import { useRef } from 'react';
import type { Group } from 'three';
import { useAutumnFoliageGeometry } from '../hooks/useAutumnFoliageGeometry';
import { useAutumnState } from '../hooks/useAutumnState';
import { useSeasonState } from '../hooks/useSeasonState';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { useRegisterAutumnSource } from '../scene/AutumnSources';
import { getAutumnCanopyStage } from '../scene/autumnCanopy';
import { getAutumnPaletteSeed } from '../scene/autumnPalette';
import { animated } from '../scene/sceneSpring';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function SeasonalMaple({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('SeasonalMaple');
    const autumn = useAutumnState();
    const season = useSeasonState();
    const globalDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = Boolean(weatherDisabled || globalDisabled);
    const stage = getAutumnCanopyStage(
        disabled ? 1 : autumn.leafRetention,
        block.id,
    );
    const source =
        stage === 'full'
            ? nodes.SeasonalMaple_Full
            : stage === 'thinning'
              ? nodes.SeasonalMaple_Thinning
              : nodes.SeasonalMaple_Sparse;
    const geometry = useAutumnFoliageGeometry(
        source.geometry,
        nodes.SeasonalMaple_Full.geometry,
        materials['Material.SeasonalMaple.Leaves'].color,
        disabled || season.season === 'spring'
            ? 0
            : autumn.foliageColorProgress,
        getAutumnPaletteSeed(block.id),
    );
    const sourceRef = useRef<Group>(null);
    useRegisterAutumnSource(block.id, sourceRef, !disabled);
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    return (
        <animated.group
            name={`SeasonalMaple:${block.id}`}
            userData={{ canopyStage: stage }}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {/* The shared falling-leaf sampler expects a support-plane plus 0.5 origin. */}
            <group ref={sourceRef} position-y={0.5} />
            <WeatheredEntityPart
                node={nodes.SeasonalMaple_Wood}
                material={nodes.SeasonalMaple_Wood.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.025, coverageMultiplier: 0.45 }
                }
                rain={disabled ? false : { glossiness: 0.15 }}
            />
            <mesh
                name="SeasonalMaple_Canopy"
                geometry={geometry}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color="white"
                    vertexColors
                    roughness={0.9}
                />
                {!disabled && (
                    <SnowOverlay
                        geometry={source.geometry}
                        maxThickness={0.025}
                        coverageMultiplier={0.45}
                    />
                )}
                {!disabled && (
                    <RainWetOverlay
                        geometry={source.geometry}
                        glossiness={0.15}
                    />
                )}
            </mesh>
        </animated.group>
    );
}
