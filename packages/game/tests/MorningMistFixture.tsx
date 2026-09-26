import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { EntityInstances } from '../src/entities/EntityInstances';
import { AutumnLeaves } from '../src/scene/AutumnLeaves';
import {
    type GameQualityTier,
    gameQualityProfiles,
} from '../src/scene/gameQuality';
import { MorningMist } from '../src/scene/MorningMist';
import { Drops } from '../src/scene/Rain/Drops';
import { Scene } from '../src/scene/Scene';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { MorningMistProbe } from './MorningMistProbe';

export function MorningMistFixture({
    tier = 'high',
    compact = false,
    rain = 0,
    fog = 1,
    wind = 0.4,
    timeOfDay = 0.27,
    snow = 0,
    disabled = false,
    mounted = true,
    dragging = false,
    live = false,
    precipitation = false,
    date = 'lateAutumn',
    fixedTime = 12,
}: {
    tier?: GameQualityTier;
    compact?: boolean;
    rain?: number;
    fog?: number;
    wind?: number;
    timeOfDay?: number;
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
                          blockId: 'mist-ground:0',
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
    const stacks = useMemo(
        () =>
            Array.from({ length: 99 }, (_, i) => {
                const x = (i % 11) - 5;
                const z = Math.floor(i / 11) - 4;
                return {
                    position: new Vector3(x, 0, z),
                    blocks: [
                        {
                            name:
                                x === 0
                                    ? 'Block_Sand'
                                    : x > 2
                                      ? 'Block_Water'
                                      : 'Block_Grass',
                            id: `mist-ground:${i}`,
                            rotation: i % 4,
                        },
                        ...(x === -5 && z === 0
                            ? [{ name: 'Tree', id: 'mist-tree', rotation: 0 }]
                            : []),
                        ...(x === 0 && z === 0
                            ? [
                                  {
                                      name: 'Stool',
                                      id: 'mist-cover',
                                      rotation: 0,
                                  },
                              ]
                            : []),
                    ],
                };
            }),
        [],
    );
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <div
                    data-testid="morning-mist-scene"
                    ref={sampleElement}
                    data-sample="{}"
                    style={{
                        width: compact ? 320 : 640,
                        height: compact ? 210 : 420,
                    }}
                >
                    <Scene
                        position={[8, 9, 12]}
                        zoom={compact ? 22.5 : 45}
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
                            <EntityInstances
                                stacks={stacks}
                                quality={gameQualityProfiles[tier]}
                                weather={{ windSpeed: 1, windDirection: 90 }}
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
                                <MorningMist
                                    stacks={stacks}
                                    gardenId={7}
                                    tier={tier}
                                    enabled={!disabled}
                                    timeOfDay={timeOfDay}
                                    weather={{
                                        foggy: fog,
                                        rainy: rain,
                                        snowy: snow,
                                        windSpeed: wind,
                                    }}
                                />
                            )}
                            <MorningMistProbe onSample={reportSample} />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
