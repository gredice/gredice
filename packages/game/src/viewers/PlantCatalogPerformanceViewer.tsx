'use client';

import { Html, OrbitControls } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { GameFlagsContext } from '../GameFlagsContext';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../generators/plant/lib/plant-definitions';
import { plantTypes } from '../generators/plant/lib/plant-presets';
import { PlantGenerator } from '../generators/plant/PlantGenerator';
import { DebugHud } from '../hud/DebugHud';
import { gameQualityProfiles } from '../scene/gameQuality';
import { Scene } from '../scene/Scene';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../useGameState';

export interface PlantCatalogPerformanceViewerProps {
    className?: string;
    debugHud?: boolean;
    showLabels?: boolean;
}

const CATALOG_COLUMNS = 10;
const CATALOG_COLUMN_SPACING = 0.72;
const CATALOG_ROW_SPACING = 0.78;
const CATALOG_PLANT_SCALE = 0.22;
const CATALOG_CAMERA_ZOOM = 180;
const CATALOG_CAMERA_POSITION: [number, number, number] = [7, 9, 11];
const CATALOG_CAMERA_TARGET: [number, number, number] = [0, 0.2, 0];
const CATALOG_FREEZE_TIME = new Date('2026-06-02T12:00:00+02:00');

const catalogPlants = Object.entries(plantTypes).sort(([left], [right]) =>
    left.localeCompare(right),
);
const catalogRows = Math.ceil(catalogPlants.length / CATALOG_COLUMNS);
const catalogWidth = CATALOG_COLUMNS * CATALOG_COLUMN_SPACING + 0.4;
const catalogDepth = catalogRows * CATALOG_ROW_SPACING + 0.4;

function CatalogPlant({
    definition,
    plantType,
}: {
    definition: PlantDefinition;
    plantType: string;
}) {
    const seed = `plant-catalog:${plantType}:generation-${MAX_PLANT_GENERATION.toString()}`;

    return (
        <PlantGenerator
            animate={false}
            flowerGrowth={1}
            fruitGrowth={1}
            generation={MAX_PLANT_GENERATION}
            plantDefinition={definition}
            seed={seed}
            showFlowers
            showLeaves
            showProduce
        />
    );
}

function CatalogGrid({ showLabels }: { showLabels: boolean }) {
    return (
        <group name={`PlantCatalog:plants:${catalogPlants.length.toString()}`}>
            <mesh
                position={[0, -0.025, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[catalogWidth, catalogDepth]} />
                <meshStandardMaterial color="#30452f" roughness={0.96} />
            </mesh>
            {catalogPlants.map(([plantType, definition], index) => {
                const column = index % CATALOG_COLUMNS;
                const row = Math.floor(index / CATALOG_COLUMNS);
                const x =
                    (column - (CATALOG_COLUMNS - 1) / 2) *
                    CATALOG_COLUMN_SPACING;
                const z = (row - (catalogRows - 1) / 2) * CATALOG_ROW_SPACING;

                return (
                    <group
                        key={plantType}
                        name={`PlantCatalog:${plantType}`}
                        position={[x, 0, z]}
                    >
                        <group scale={CATALOG_PLANT_SCALE}>
                            <CatalogPlant
                                definition={definition}
                                plantType={plantType}
                            />
                        </group>
                        {showLabels && (
                            <Html
                                center
                                position={[0, 0.015, 0.29]}
                                style={{ pointerEvents: 'none' }}
                                zIndexRange={[1, 0]}
                            >
                                <div
                                    title={definition.name}
                                    style={{
                                        background: 'rgba(9, 16, 10, 0.78)',
                                        borderRadius: '3px',
                                        color: '#f4f7f2',
                                        fontFamily: 'ui-monospace, monospace',
                                        fontSize: '9px',
                                        lineHeight: 1,
                                        padding: '2px 4px',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {plantType}
                                </div>
                            </Html>
                        )}
                    </group>
                );
            })}
        </group>
    );
}

export function PlantCatalogPerformanceViewer({
    className,
    debugHud = true,
    showLabels = false,
}: PlantCatalogPerformanceViewerProps) {
    const [queryClient] = useState(() => new QueryClient());
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: '',
            dayNightCycleDisabled: true,
            freezeTime: CATALOG_FREEZE_TIME,
            isMock: true,
            winterMode: 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

    return (
        <QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={storeRef.current}>
                <GameFlagsContext.Provider
                    value={{ enableDebugHudFlag: debugHud }}
                >
                    <Scene
                        className={className}
                        debugStats={debugHud}
                        fixedTimeSeconds={12 * 60 * 60}
                        pixelRatio={1}
                        position={CATALOG_CAMERA_POSITION}
                        quality={gameQualityProfiles.medium}
                        zoom={CATALOG_CAMERA_ZOOM}
                    >
                        <color attach="background" args={['#172018']} />
                        <ambientLight intensity={0.72} />
                        <hemisphereLight
                            color="#f3fff0"
                            groundColor="#263422"
                            intensity={0.85}
                        />
                        <directionalLight
                            castShadow
                            intensity={1.45}
                            position={[5, 10, 7.5]}
                            shadow-mapSize-height={2048}
                            shadow-mapSize-width={2048}
                            shadow-normalBias={0.025}
                        />
                        <CatalogGrid showLabels={showLabels} />
                        <OrbitControls
                            enableDamping={false}
                            maxZoom={420}
                            minZoom={120}
                            target={CATALOG_CAMERA_TARGET}
                        />
                    </Scene>
                    {debugHud && <DebugHud />}
                </GameFlagsContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
