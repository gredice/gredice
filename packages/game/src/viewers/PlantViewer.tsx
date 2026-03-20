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
} from '../useGameState';

const APP_BASE_URL = 'https://vrt.gredice.com';

export interface PlantViewerProps {
    plantType: keyof typeof plantTypes;
    generation: number;
    seed?: string;
    className?: string;
}

const zoom = 600;
const cameraPosition: [x: number, y: number, z: number] = [-100, 100, -100];
const orbitTarget: [x: number, y: number, z: number] = [0, 0.9, 0];

export function PlantViewer({
    plantType,
    generation,
    seed = 'viewer',
    className,
}: PlantViewerProps) {
    const definition = plantTypes[plantType];

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
            freezeTime: new Date('2024-06-21T10:00:00'),
            isMock: true,
            winterMode: 'summer',
        });
    }

    return (
        <GameStateContext.Provider value={storeRef.current}>
            <Scene position={cameraPosition} zoom={zoom} className={className}>
                <ambientLight intensity={0.7} />
                <directionalLight
                    position={[5, 10, 7.5]}
                    intensity={1.5}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                <Environment noWeather noBackground noSound />
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
