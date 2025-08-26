'use client';

import { OrbitControls, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { models } from '../../../data/models';
import { RaisedBed } from '../../../entities/RaisedBed';
import { Environment } from '../../../scene/Environment';
import { Scene } from '../../../scene/Scene';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
} from '../../../useGameState';
import { generateLSystemStringWithGenerations } from '../lib/l-system';
import { SeededRNG } from '../lib/rng';
import { PlantGenerator } from '../PlantGenerator';
import { DesktopControls } from './components/DesktopControls';
import { ExportDialog } from './components/ExportDialog';
import { MobileControls } from './components/MobileControls';
import { usePlantState } from './hooks/usePlantState';

const zoom = 1000;
const cameraPosition: [x: number, y: number, z: number] = [-100, 100, -100];

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export function PlantEditor() {
    const {
        state,
        visibility,
        updateState,
        updateVisibility,
        updateDefinition,
        randomizeSeed,
        saveDefinitionToStorage,
        createCustomPlant,
        deleteCustomPlant,
    } = usePlantState();

    // Debounce definition changes for localStorage saving
    const debouncedDefinition = useDebounce(state.definition, 500);

    /**
     * Save debounced definition changes to localStorage
     */
    useEffect(() => {
        saveDefinitionToStorage(debouncedDefinition, state.plantType);
    }, [debouncedDefinition, state.plantType, saveDefinitionToStorage]);

    /**
     * Handle L-system rules changes
     */
    const handleRulesChange = (newRules: Record<string, any>) => {
        updateDefinition('rules', newRules);
    };

    /**
     * Generate L-system symbols based on current parameters
     */
    const lSystemSymbols = useMemo(() => {
        const rng = new SeededRNG(state.seed);
        return generateLSystemStringWithGenerations(
            state.definition.axiom,
            state.definition.rules,
            state.generation,
            rng,
        );
    }, [
        state.definition.axiom,
        state.definition.rules,
        state.generation,
        state.seed,
    ]);

    /**
     * Generate L-system chain string for display
     */
    const lSystemChain = useMemo(
        () => lSystemSymbols.map((s) => s.char).join(''),
        [lSystemSymbols],
    );

    /**
     * Common props for control components
     */
    const controlProps = {
        state,
        visibility,
        onStateChange: updateState,
        onVisibilityChange: updateVisibility,
        onDefinitionChange: updateDefinition,
        onRulesChange: handleRulesChange,
        onRandomizeSeed: randomizeSeed,
        onCreateCustomPlant: createCustomPlant,
        onDeleteCustomPlant: deleteCustomPlant,
        lSystemChain,
    };

    const freezeTime = new Date('2024-06-21T10:00:00'); // Noon on summer solstice
    const mockGarden = true;
    const appBaseUrl = 'https://vrt.gredice.com';
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            freezeTime: freezeTime || null,
            isMock: mockGarden || false,
        });
    }

    useGLTF.preload((appBaseUrl ?? '') + models.GameAssets.url);

    return (
        <div className="w-full h-[calc(100vh-64px)] relative">
            <GameStateContext.Provider value={storeRef.current}>
                <Scene position={cameraPosition} zoom={zoom}>
                    {/* Lighting */}
                    <ambientLight intensity={0.7} />
                    <directionalLight
                        position={[5, 10, 7.5]}
                        intensity={1.5}
                        castShadow
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                    />

                    {/* Environment */}
                    <Environment noWeather noBackground noSound />

                    {/* Plant */}
                    <group position={[0, 0.7, 0]}>
                        <PlantGenerator
                            key={`${state.plantType}-${state.seed}`}
                            plantDefinition={state.definition}
                            lSystemSymbols={lSystemSymbols}
                            generation={state.generation}
                            seed={state.seed}
                            flowerGrowth={state.flowerGrowth}
                            fruitGrowth={state.fruitGrowth}
                            showLeaves={visibility.showLeaves}
                            showFlowers={visibility.showFlowers}
                            showProduce={visibility.showProduce}
                        />

                        <RaisedBed
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

                    {/* Camera Controls */}
                    <OrbitControls
                        minDistance={1}
                        maxDistance={40}
                        target={[0, 1, 0]}
                    />
                </Scene>
            </GameStateContext.Provider>

            {/* Export Button */}
            <div className="absolute top-2 right-2 z-50">
                <ExportDialog definition={state.definition} />
            </div>

            {/* Mobile Controls */}
            <div className="absolute top-2 left-2 z-50">
                <MobileControls
                    {...controlProps}
                    isOpen={state.isSheetOpen}
                    onOpenChange={(open) => updateState({ isSheetOpen: open })}
                />
            </div>

            {/* Desktop Controls */}
            <DesktopControls {...controlProps} />
        </div>
    );
}
