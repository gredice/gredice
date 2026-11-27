import { MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import { useRef } from 'react';
import type { Group } from 'three';
import { useAutumnFoliageGeometry } from '../hooks/useAutumnFoliageGeometry';
import { useAutumnState } from '../hooks/useAutumnState';
import { useSeasonState } from '../hooks/useSeasonState';
import { useRegisterAutumnSource } from '../scene/AutumnSources';
import {
    getAutumnTreeCanopyStage,
    resolveTreeFoliageColorProgress,
} from '../scene/autumnCanopy';
import { getAutumnPaletteSeed } from '../scene/autumnPalette';
import { animated } from '../scene/sceneSpring';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    resolveTimeDrivenMaterialSpeed,
    useTimeDrivenMaterialAnimation,
} from './helpers/timeDrivenMaterialAnimation';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { treeEntityScale } from './treeEntityScale';

export function Tree({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const sourceRef = useRef<Group>(null);
    useRegisterAutumnSource(block.id, sourceRef, !weatherDisabled);
    const { nodes, materials } = useGameGLTF('Tree');
    const autumn = useAutumnState();
    const season = useSeasonState();
    const visualizationDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const progress =
        weatherDisabled || visualizationDisabled
            ? 0
            : resolveTreeFoliageColorProgress(
                  autumn.foliageColorProgress,
                  season.season,
              );
    const canopyStage = getAutumnTreeCanopyStage(
        weatherDisabled || visualizationDisabled ? 1 : autumn.leafRetention,
        block.id,
    );
    // A bare winter tree draws no crown; the sparse crown only keeps the
    // foliage hooks below stable.
    const canopyGeometry =
        canopyStage === 'full'
            ? nodes.Tree_1_2.geometry
            : canopyStage === 'thinning'
              ? nodes.Tree_AutumnThinning.geometry
              : nodes.Tree_AutumnSparse.geometry;
    const leafGeometry = useAutumnFoliageGeometry(
        canopyGeometry,
        nodes.Tree_1_2.geometry,
        materials['Material.Leaves'].color,
        progress,
        getAutumnPaletteSeed(block.id),
    );
    const sprigGeometry = useAutumnFoliageGeometry(
        nodes.Tree_1_3.geometry,
        nodes.Tree_1_2.geometry,
        materials['Material.GrassPart'].color,
        progress,
        getAutumnPaletteSeed(block.id),
    );
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const materialAnimationActive = useTimeDrivenMaterialAnimation();

    return (
        <animated.group
            ref={sourceRef}
            position={stack.position.clone().setY(currentStackHeight + 0.5)}
            scale={treeEntityScale}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tree_1_1.geometry}
                material={materials['Material.Planks']}
            />
            {canopyStage !== 'bare' && (
                <>
                    <mesh
                        name={`Autumn:Canopy:${block.id}`}
                        castShadow
                        receiveShadow
                        geometry={leafGeometry}
                    >
                        <MeshDistortMaterial
                            {...materials['Material.Leaves']}
                            color="white"
                            vertexColors
                            distort={0.1}
                            speed={resolveTimeDrivenMaterialSpeed(
                                2,
                                materialAnimationActive,
                            )}
                        />
                    </mesh>
                    <SnowOverlay
                        geometry={canopyGeometry}
                        {...snowPresets.treeCanopyInner}
                        renderOrder={2}
                    />
                </>
            )}
            {canopyStage !== 'full' && (
                <>
                    <mesh
                        name={`Autumn:Branches:${block.id}`}
                        castShadow
                        receiveShadow
                        geometry={nodes.Tree_AutumnBranches.geometry}
                        material={materials['Material.Planks']}
                    />
                    <SnowOverlay
                        geometry={nodes.Tree_AutumnBranches.geometry}
                        {...snowPresets.treeBranches}
                    />
                </>
            )}
            {canopyStage === 'full' && (
                <mesh
                    name={`Autumn:Sprigs:${block.id}`}
                    castShadow
                    receiveShadow
                    geometry={sprigGeometry}
                >
                    <MeshWobbleMaterial
                        {...materials['Material.GrassPart']}
                        color="white"
                        vertexColors
                        factor={0.02}
                        speed={resolveTimeDrivenMaterialSpeed(
                            2,
                            materialAnimationActive,
                        )}
                    />
                </mesh>
            )}
        </animated.group>
    );
}
