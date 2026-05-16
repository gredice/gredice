'use client';

import { OrbitControls, useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { models } from '../data/models';
import { BlockGround } from '../entities/BlockGround';
import { useGeneratedLSystemSymbols } from '../generators/plant/hooks/useGeneratedLSystem';
import { plantTypes } from '../generators/plant/lib/plant-presets';
import { PlantGenerator } from '../generators/plant/PlantGenerator';
import { Environment } from '../scene/Environment';
import { Scene } from '../scene/Scene';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../useGameState';

const APP_BASE_URL = 'https://vrt.gredice.com';

export interface PlantViewerProps {
    plantType: keyof typeof plantTypes;
    generation: number;
    seed?: string;
    className?: string;
    animate?: boolean;
    includeEnvironment?: boolean;
    lightingPreset?: 'default' | 'snapshot';
    zoom?: number;
    cameraPosition?: [x: number, y: number, z: number];
    orbitTarget?: [x: number, y: number, z: number];
}

const defaultZoom = 600;
const defaultCameraPosition: [x: number, y: number, z: number] = [
    -100, 100, -100,
];
const defaultOrbitTarget: [x: number, y: number, z: number] = [0, 0.9, 0];

const lightingPresets = {
    default: {
        ambientIntensity: 0.7,
        keyIntensity: 1.5,
        keyPosition: [5, 10, 7.5] as const,
        shadowIntensity: 1,
    },
    snapshot: {
        ambientIntensity: 2.35,
        fillIntensity: 1.1,
        fillPosition: [-8, 10, -6] as const,
        hemisphereGroundColor: '#d8c5a5',
        hemisphereIntensity: 2.2,
        hemisphereSkyColor: '#f5fff3',
        keyIntensity: 3.4,
        keyPosition: [6, 18, 10] as const,
        shadowIntensity: 0.22,
    },
};

export function PlantViewer({
    plantType,
    generation,
    seed = 'viewer',
    className,
    animate = true,
    includeEnvironment = true,
    lightingPreset = 'default',
    zoom = defaultZoom,
    cameraPosition = defaultCameraPosition,
    orbitTarget = defaultOrbitTarget,
}: PlantViewerProps) {
    const definition = plantTypes[plantType];
    const lighting = lightingPresets[lightingPreset];
    const snapshotLighting = lightingPresets.snapshot;

    const lSystemTask = useMemo(
        () => ({
            axiom: definition.axiom,
            iterations: Math.ceil(generation),
            rules: definition.rules,
            seed,
        }),
        [definition.axiom, definition.rules, generation, seed],
    );
    const { symbols: lSystemSymbols } = useGeneratedLSystemSymbols(
        lSystemTask,
        {
            syncInitialResult: true,
        },
    );

    useGLTF.preload(APP_BASE_URL + models.GameAssets.url);

    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: APP_BASE_URL,
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            winterMode: 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

    return (
        <GameStateContext.Provider value={storeRef.current}>
            <Scene position={cameraPosition} zoom={zoom} className={className}>
                <ambientLight intensity={lighting.ambientIntensity} />
                {lightingPreset === 'snapshot' && (
                    <hemisphereLight
                        position={[0, 1, 0]}
                        color={snapshotLighting.hemisphereSkyColor}
                        groundColor={snapshotLighting.hemisphereGroundColor}
                        intensity={snapshotLighting.hemisphereIntensity}
                    />
                )}
                <directionalLight
                    position={lighting.keyPosition}
                    intensity={lighting.keyIntensity}
                    shadow-intensity={lighting.shadowIntensity}
                    shadow-radius={2}
                    shadow-normalBias={0.025}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                {lightingPreset === 'snapshot' && (
                    <directionalLight
                        position={snapshotLighting.fillPosition}
                        intensity={snapshotLighting.fillIntensity}
                    />
                )}
                {includeEnvironment && (
                    <Environment noWeather noBackground noSound />
                )}
                <group position={[0, 0.5, 0]}>
                    <group position={[0, 0.4, 0]}>
                        <PlantGenerator
                            key={`${plantType}-${seed}`}
                            plantDefinition={definition}
                            lSystemSymbols={lSystemSymbols ?? []}
                            generation={generation}
                            seed={seed}
                            flowerGrowth={1}
                            fruitGrowth={1}
                            animate={animate}
                            showLeaves
                            showFlowers
                            showProduce
                        />
                    </group>
                    <BlockGround
                        stack={{
                            position: new Vector3(0, 0, 0),
                            blocks: [],
                        }}
                        block={{
                            id: '',
                            name: '',
                            rotation: 0,
                            variant: undefined,
                        }}
                        rotation={0}
                    />
                </group>
                <OrbitControls
                    minDistance={1}
                    maxDistance={40}
                    target={orbitTarget}
                />
            </Scene>
        </GameStateContext.Provider>
    );
}

export { MAX_PLANT_GENERATION } from '../generators/plant/lib/plant-definition-types';
export { plantTypes } from '../generators/plant/lib/plant-presets';
