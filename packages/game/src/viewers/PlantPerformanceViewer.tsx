'use client';

import { Html } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { RaisedBedGeneratedPlantBatch } from '../entities/raisedBed/RaisedBedGeneratedPlantBatch';
import { plantTypes } from '../generators/plant/lib/plant-presets';
import { Environment } from '../scene/Environment';
import { Scene } from '../scene/Scene';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
} from '../useGameState';

export interface PlantPerformanceViewerProps {
    className?: string;
}

const PRESET_COLUMNS = 5;
const PRESET_SPACING = 3.4;
const INSTANCE_GRID = 3;
const INSTANCE_SPACING = 0.42;

export function PlantPerformanceViewer({
    className,
}: PlantPerformanceViewerProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: '',
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            winterMode: 'summer',
        });
    }

    const presets = useMemo(() => {
        return Object.entries(plantTypes).map(([key, definition], index) => {
            const column = index % PRESET_COLUMNS;
            const row = Math.floor(index / PRESET_COLUMNS);
            const position: [number, number, number] = [
                column * PRESET_SPACING,
                0,
                row * PRESET_SPACING,
            ];
            const instances = Array.from(
                { length: INSTANCE_GRID * INSTANCE_GRID },
                (_, instanceIndex) => {
                    const instanceColumn = instanceIndex % INSTANCE_GRID;
                    const instanceRow = Math.floor(
                        instanceIndex / INSTANCE_GRID,
                    );

                    return {
                        generation: 8.8,
                        position: [
                            (instanceColumn - (INSTANCE_GRID - 1) / 2) *
                                INSTANCE_SPACING,
                            0.02,
                            (instanceRow - (INSTANCE_GRID - 1) / 2) *
                                INSTANCE_SPACING,
                        ] as const,
                        scale: 0.28,
                        seed: `${key}:${instanceIndex}`,
                    };
                },
            );

            return {
                definition,
                key,
                label: definition.name,
                position,
                instances,
            };
        });
    }, []);

    const rowCount = Math.ceil(presets.length / PRESET_COLUMNS);
    const centerX = ((PRESET_COLUMNS - 1) * PRESET_SPACING) / 2;
    const centerZ = ((rowCount - 1) * PRESET_SPACING) / 2;

    return (
        <GameStateContext.Provider value={storeRef.current}>
            <Scene position={150} zoom={28} className={className}>
                <ambientLight intensity={0.8} />
                <directionalLight
                    position={[8, 14, 10]}
                    intensity={1.5}
                    castShadow
                />
                <Environment noBackground noSound noWeather />
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, -0.02, 0]}
                    receiveShadow
                >
                    <planeGeometry args={[80, 80]} />
                    <meshStandardMaterial color="#536b3a" roughness={0.94} />
                </mesh>
                <group position={[-centerX, 0, -centerZ]}>
                    {presets.map((preset) => (
                        <group key={preset.key} position={preset.position}>
                            <mesh
                                rotation={[-Math.PI / 2, 0, 0]}
                                position={[0, 0, 0]}
                                receiveShadow
                            >
                                <planeGeometry args={[2.2, 2.2]} />
                                <meshStandardMaterial
                                    color="#654a35"
                                    roughness={0.95}
                                />
                            </mesh>
                            <RaisedBedGeneratedPlantBatch
                                definition={preset.definition}
                                instances={preset.instances}
                            />
                            <Html
                                position={[0, 0.12, 1.32]}
                                center
                                distanceFactor={18}
                            >
                                <div className="rounded bg-black/70 px-2 py-1 text-[10px] text-white whitespace-nowrap">
                                    {preset.label}
                                </div>
                            </Html>
                        </group>
                    ))}
                </group>
            </Scene>
        </GameStateContext.Provider>
    );
}
