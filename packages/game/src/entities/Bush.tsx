import { MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import { useRef } from 'react';
import type { Group } from 'three';
import { useAutumnFoliageGeometry } from '../hooks/useAutumnFoliageGeometry';
import { useAutumnState } from '../hooks/useAutumnState';
import { useRegisterAutumnSource } from '../scene/AutumnSources';
import { getAutumnCanopyStage } from '../scene/autumnCanopy';
import { getAutumnPaletteSeed } from '../scene/autumnPalette';
import { bushTextureColor } from '../scene/bushFoliage';
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

export function Bush({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const sourceRef = useRef<Group>(null);
    useRegisterAutumnSource(block.id, sourceRef, !weatherDisabled, 'bush');
    const { nodes, materials } = useGameGLTF('Bush');
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
            ? nodes.Bush_1_1.geometry
            : canopyStage === 'thinning'
              ? nodes.Bush_AutumnThinning.geometry
              : nodes.Bush_AutumnSparse.geometry;
    const leafGeometry = useAutumnFoliageGeometry(
        canopyGeometry,
        nodes.Bush_1_1.geometry,
        materials['Material.ColorPaletteMain'].color,
        progress,
        getAutumnPaletteSeed(block.id),
        bushTextureColor,
    );
    const sprigGeometry = useAutumnFoliageGeometry(
        nodes.Bush_1_2.geometry,
        nodes.Bush_1_1.geometry,
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
            position={stack.position.clone().setY(currentStackHeight)}
            scale={[0.5, 0.5, 0.5]}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                name={`Autumn:BushCanopy:${block.id}`}
                castShadow
                receiveShadow
                geometry={leafGeometry}
            >
                <MeshDistortMaterial
                    {...materials['Material.ColorPaletteMain']}
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
                {...snowPresets.bushCore}
                renderOrder={2}
            />
            {canopyStage !== 'full' && (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.Bush_AutumnBranches.geometry}
                    material={materials['Material.BushBranches']}
                />
            )}
            {canopyStage === 'full' && (
                <mesh
                    name={`Autumn:BushSprigs:${block.id}`}
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
                            3,
                            materialAnimationActive,
                        )}
                    />
                    <SnowOverlay
                        geometry={nodes.Bush_1_2.geometry}
                        {...snowPresets.bushFoliage}
                    />
                </mesh>
            )}
        </animated.group>
    );
}
