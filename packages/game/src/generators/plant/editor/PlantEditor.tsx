'use client';

import { OrbitControls, useGLTF } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useGeneratedLSystemSymbols } from '../hooks/useGeneratedLSystem';
import { serializeLSystemSymbols } from '../lib/l-system';
import { MAX_PLANT_GENERATION, type Rule } from '../lib/plant-definitions';
import { PlantGenerator } from '../PlantGenerator';
import { DesktopControls } from './components/DesktopControls';
import { EditorGrassContext } from './components/EditorGrassContext';
import { MobileControls } from './components/MobileControls';
import { usePlantState } from './hooks/usePlantState';

const zoom = 1000;
const cameraPosition: [x: number, y: number, z: number] = [-100, 100, -100];
const desktopEditorTarget: [x: number, y: number, z: number] = [-0.55, 0.9, 0];
const mobileEditorTarget: [x: number, y: number, z: number] = [0, 0.9, 0];

export function PlantEditor() {
    const [isDesktop, setIsDesktop] = useState(false);
    const {
        state,
        visibility,
        updateState,
        updateVisibility,
        updateDefinition,
        selectPlantType,
        randomizeSeed,
        undo,
        redo,
        canUndo,
        canRedo,
        resetDefinition,
        canResetDefinition,
        saveDefinitionToStorage,
        createCustomPlant,
        deleteCustomPlant,
    } = usePlantState();

    // Debounce definition changes for localStorage saving (ref-based to avoid re-renders)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveDefinitionToStorage(state.definition, state.plantType);
        }, 500);
        return () => clearTimeout(saveTimeoutRef.current);
    }, [state.definition, state.plantType, saveDefinitionToStorage]);

    /**
     * Handle L-system rules changes
     */
    const handleRulesChange = useCallback(
        (newRules: Record<string, Rule>) => {
            updateDefinition('rules', newRules);
        },
        [updateDefinition],
    );

    const stepGeneration = useCallback(
        (delta: number) => {
            const nextGeneration =
                Math.round(
                    Math.min(
                        MAX_PLANT_GENERATION,
                        Math.max(0, state.generation + delta),
                    ) * 10,
                ) / 10;

            if (nextGeneration !== state.generation) {
                updateState({ generation: nextGeneration });
            }
        },
        [state.generation, updateState],
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 768px)');
        const handleChange = (event: MediaQueryListEvent) =>
            setIsDesktop(event.matches);

        setIsDesktop(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT')
            ) {
                return;
            }

            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                event.preventDefault();
                stepGeneration(event.shiftKey ? 0.1 : 1);
                return;
            }

            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                event.preventDefault();
                stepGeneration(event.shiftKey ? -0.1 : -1);
                return;
            }

            if (!event.metaKey && !event.ctrlKey) {
                return;
            }

            const key = event.key.toLowerCase();
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault();
                undo();
                return;
            }

            if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [redo, stepGeneration, undo]);

    /**
     * Generate L-system symbols based on current parameters
     */
    const lSystemTask = useMemo(
        () => ({
            axiom: state.definition.axiom,
            iterations: Math.ceil(state.generation),
            rules: state.definition.rules,
            seed: state.seed,
        }),
        [
            state.definition.axiom,
            state.definition.rules,
            state.generation,
            state.seed,
        ],
    );
    const { symbols: lSystemSymbolsResult } = useGeneratedLSystemSymbols(
        lSystemTask,
        {
            syncInitialResult: true,
        },
    );
    const lSystemSymbols = lSystemSymbolsResult ?? [];

    /**
     * Generate L-system chain string for display
     */
    const lSystemChain = useMemo(
        () => serializeLSystemSymbols(lSystemSymbols),
        [lSystemSymbols],
    );
    const orbitTarget = isDesktop ? desktopEditorTarget : mobileEditorTarget;

    /**
     * Common props for control components
     */
    const controlProps = {
        state,
        visibility,
        onStateChange: updateState,
        onPlantTypeChange: selectPlantType,
        onVisibilityChange: updateVisibility,
        onDefinitionChange: updateDefinition,
        onRulesChange: handleRulesChange,
        onRandomizeSeed: randomizeSeed,
        onUndo: undo,
        onRedo: redo,
        onResetDefinition: resetDefinition,
        canUndo,
        canRedo,
        canResetDefinition,
        onCreateCustomPlant: createCustomPlant,
        onDeleteCustomPlant: deleteCustomPlant,
        lSystemChain,
        lSystemSymbolCount: lSystemSymbols.length,
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
            winterMode: 'summer',
        });
    }

    useGLTF.preload((appBaseUrl ?? '') + models.GameAssets.url);

    return (
        <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden">
            <DesktopControls {...controlProps} />

            <div className="relative h-full w-full">
                <GameStateContext.Provider value={storeRef.current}>
                    <Scene
                        position={cameraPosition}
                        zoom={zoom}
                        className="h-full w-full"
                    >
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

                        <mesh
                            position={[0, 0.02, 0]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            receiveShadow
                        >
                            <circleGeometry args={[4, 64]} />
                            <meshStandardMaterial
                                color="#445134"
                                roughness={1}
                                transparent
                                opacity={0.16}
                            />
                        </mesh>

                        {/* Plant */}
                        <group position={[0, 0.7, 0]}>
                            <EditorGrassContext />
                            <group position={[0, 0.25, 0]}>
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
                            </group>

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
                            target={orbitTarget}
                        />
                    </Scene>
                </GameStateContext.Provider>

                {/* Mobile Controls */}
                <div className="absolute top-2 left-2 z-50 md:hidden">
                    <MobileControls
                        {...controlProps}
                        isOpen={state.isSheetOpen}
                        onOpenChange={(open) =>
                            updateState({ isSheetOpen: open })
                        }
                    />
                </div>
            </div>
        </div>
    );
}
