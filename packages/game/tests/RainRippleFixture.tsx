import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { EntityInstances } from '../src/entities/EntityInstances';
import { Squirrels } from '../src/entities/squirrels/Squirrels';
import { RainRipples } from '../src/rain/RainRipples';
import { AutumnLeaves } from '../src/scene/AutumnLeaves';
import {
    type GameQualityTier,
    gameQualityProfiles,
} from '../src/scene/gameQuality';
import { Drops } from '../src/scene/Rain/Drops';
import { Scene } from '../src/scene/Scene';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { RainRippleProbe } from './RainRippleProbe';

export function RainRippleFixture({
    surface,
    mixedSurfaces = false,
    waterOnSlopes = false,
    squirrels = false,
    renderLayers = true,
    focusSquirrel = false,
    startleSquirrel = false,
    seasonalSquirrels = true,
    tier = 'high',
    rain = 1,
    snow = 0,
    disabled = false,
    mounted = true,
    dragging = false,
    live = false,
    precipitation = false,
    date = 'lateAutumn',
    fixedTime = 12,
}: {
    surface?: string;
    mixedSurfaces?: boolean;
    waterOnSlopes?: boolean;
    squirrels?: boolean;
    renderLayers?: boolean;
    focusSquirrel?: boolean;
    startleSquirrel?: boolean;
    seasonalSquirrels?: boolean;
    tier?: GameQualityTier;
    rain?: number;
    snow?: number;
    disabled?: boolean;
    mounted?: boolean;
    dragging?: boolean;
    live?: boolean;
    precipitation?: boolean;
    date?: 'summer' | 'lateAutumn' | 'winter';
    fixedTime?: number;
}) {
    const sampleElement = useRef<HTMLDivElement>(null);
    const reportSample = useCallback((sample: string) => {
        // Keep per-frame telemetry out of React so observation does not keep
        // rebuilding the scene or compete with screenshot actionability.
        if (sampleElement.current)
            sampleElement.current.dataset.sample = sample;
    }, []);
    const client = useMemo(() => new QueryClient(), []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                freezeTime: getSeasonDebugDates()[date],
            }),
        [date],
    );
    useDisposeGameStateStore(store);
    useEffect(() => {
        store.setState({
            rainSurfaceIntensity: disabled ? 0 : rain,
            snowCoverage: snow,
            weatherVisualizationDisabled: disabled,
            activeDragPreview: dragging
                ? {
                      source: {
                          blockId: 'ripple-ground:0',
                          blockIndex: 0,
                          stackPosition: { x: -5, z: -4 },
                      },
                      targets: [],
                      hoveredGardenBoxBlockId: null,
                      relative: { x: 0, z: 0 },
                      isBlocked: false,
                      isOverRecycler: false,
                  }
                : null,
        });
    }, [store, disabled, rain, snow, dragging]);
    useEffect(() => {
        if (startleSquirrel)
            store.getState().triggerAnimalDebugBehavior({
                species: 'Squirrel',
                behavior: 'flee',
            });
    }, [store, startleSquirrel]);
    const stacks = useMemo(() => {
        // Individual material/shoreline checks need only a small garden.
        // Keep the mixed scene and existing cap/performance fixtures at 99.
        const columns = surface ? 5 : 11;
        const rows = surface ? 5 : 9;
        return Array.from({ length: columns * rows }, (_, i) => {
            const x = (i % columns) - Math.floor(columns / 2);
            const z = Math.floor(i / columns) - Math.floor(rows / 2);
            return {
                position: new Vector3(x, 0, z),
                blocks: [
                    ...(waterOnSlopes
                        ? [
                              {
                                  name: 'Block_Grass_Reverse_Corner',
                                  id: `ripple-bank:${i}`,
                                  rotation: i % 4,
                              },
                          ]
                        : []),
                    {
                        name:
                            surface ??
                            (mixedSurfaces
                                ? [
                                      'Block_Water',
                                      'Block_Swamp_Water',
                                      'Block_Grass',
                                      'Block_Ground',
                                      'Block_Dry_Ground',
                                      'Block_Polished_Stone',
                                      'Block_Sand',
                                      'Block_Swamp_Ground',
                                  ][Math.floor(i / 11) % 8]
                                : i % 2
                                  ? 'Block_Sand'
                                  : 'Block_Swamp_Ground'),
                        id: `ripple-ground:${i}`,
                        rotation: i % 4,
                    },
                    ...(x === -5 && z === 0
                        ? [{ name: 'Tree', id: 'ripple-tree', rotation: 0 }]
                        : []),
                    ...(x === 0 && z === 0
                        ? [
                              {
                                  name: 'Stool',
                                  id: 'ripple-cover',
                                  rotation: 0,
                              },
                          ]
                        : []),
                ],
            };
        });
    }, [surface, mixedSurfaces, waterOnSlopes]);
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <div
                    data-testid="rain-ripple-scene"
                    ref={sampleElement}
                    data-sample="{}"
                    style={{ width: 640, height: 420 }}
                >
                    <Scene
                        position={[8, 9, 12]}
                        zoom={focusSquirrel ? 500 : surface ? 75 : 45}
                        quality={gameQualityProfiles.low}
                        fixedTimeSeconds={live ? undefined : fixedTime}
                        profileStats
                    >
                        <color attach="background" args={['#d1dbe0']} />
                        <ambientLight intensity={1.5} />
                        <directionalLight
                            position={[4, 8, 3]}
                            intensity={1.5}
                        />
                        <Suspense fallback={null}>
                            {renderLayers && (
                                <>
                                    <EntityInstances
                                        stacks={stacks}
                                        quality={gameQualityProfiles[tier]}
                                        weather={{
                                            windSpeed: 1,
                                            windDirection: 90,
                                        }}
                                        renderGroundDecorations={false}
                                    />
                                    <AutumnLeaves
                                        stacks={stacks}
                                        gardenId={7}
                                        tier={tier}
                                        windSpeed={1}
                                        rain={rain}
                                        snow={snow}
                                        enabled={!disabled}
                                    />
                                    {precipitation && rain > 0 && (
                                        <Drops intensity={rain} count={700} />
                                    )}
                                    {mounted && (
                                        <RainRipples
                                            stacks={stacks}
                                            gardenId={7}
                                            tier={tier}
                                            enabled={!disabled}
                                            snow={snow}
                                        />
                                    )}
                                </>
                            )}
                            {squirrels && (
                                <Squirrels
                                    farmId={7}
                                    stacks={stacks}
                                    seasonalEffectsEnabled={seasonalSquirrels}
                                />
                            )}
                            <RainRippleProbe
                                onSample={reportSample}
                                focusSquirrel={focusSquirrel}
                            />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
