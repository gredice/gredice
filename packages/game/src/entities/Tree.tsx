import { MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { useAutumnState } from '../hooks/useAutumnState';
import { useRegisterAutumnSource } from '../scene/AutumnSources';
import { getAutumnCanopyStage } from '../scene/autumnCanopy';
import {
    getAutumnLeafColor,
    getAutumnPaletteSeed,
} from '../scene/autumnPalette';
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
    const visualizationDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const progress =
        weatherDisabled || visualizationDisabled
            ? 0
            : autumn.foliageColorProgress;
    const canopyStage = getAutumnCanopyStage(
        weatherDisabled || visualizationDisabled ? 1 : autumn.leafRetention,
        block.id,
    );
    const canopyGeometry =
        canopyStage === 'full'
            ? nodes.Tree_1_2.geometry
            : canopyStage === 'thinning'
              ? nodes.Tree_AutumnThinning.geometry
              : nodes.Tree_AutumnSparse.geometry;
    const leafColor = useMemo(
        () =>
            getAutumnLeafColor(
                materials['Material.Leaves'].color,
                progress,
                getAutumnPaletteSeed(block.id),
            ),
        [materials, progress, block.id],
    );
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const materialAnimationActive = useTimeDrivenMaterialAnimation();

    return (
        <animated.group
            ref={sourceRef}
            position={stack.position.clone().setY(currentStackHeight + 0.5)}
            scale={[0.125, 0.5, 0.125]}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tree_1_1.geometry}
                material={materials['Material.Planks']}
            />
            <mesh
                name={`Autumn:Canopy:${block.id}`}
                castShadow
                receiveShadow
                geometry={canopyGeometry}
            >
                <MeshDistortMaterial
                    {...materials['Material.Leaves']}
                    color={leafColor}
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
            {canopyStage !== 'full' && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Tree_AutumnBranches.geometry}
                    material={materials['Material.Planks']}
                />
            )}
            {canopyStage === 'full' && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Tree_1_3.geometry}
                >
                    <MeshWobbleMaterial
                        {...materials['Material.GrassPart']}
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
