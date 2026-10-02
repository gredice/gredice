import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { EntityInstances } from '../src/entities/EntityInstances';
import { RainRipples } from '../src/rain/RainRipples';
import { AutumnLeaves } from '../src/scene/AutumnLeaves';
import { ColdWeatherEffects } from '../src/scene/cold/ColdWeatherEffects';
import type { ColdWeatherInput } from '../src/scene/cold/coldWeather';
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
import { ColdWeatherActor } from './ColdWeatherActor';
import { ColdWeatherProbe } from './ColdWeatherProbe';

const actorIds = Array.from({ length: 10 }, (_, index) => ({
    id: `cold-actor:${index}`,
    index,
}));

export function ColdWeatherFixture({
    tier = 'high',
    rain = 0,
    snow = 0,
    disabled = false,
    mounted = true,
    dragging = false,
    live = false,
    precipitation = false,
    date = 'lateAutumn',
    fixedTime = 12,
    weather = { temperature: -4 },
}: {
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
    weather?: ColdWeatherInput;
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
    const stacks = useMemo(
        () =>
            Array.from({ length: 99 }, (_, i) => {
                const x = (i % 11) - 5;
                const z = Math.floor(i / 11) - 4;
                return {
                    position: new Vector3(x, 0, z),
                    blocks: [
                        {
                            name: i % 2 ? 'Block_Grass' : 'Block_Sand',
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
            }),
        [],
    );
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <div
                    data-testid="cold-weather-scene"
                    ref={sampleElement}
                    data-sample="{}"
                    style={{ width: 640, height: 420 }}
                >
                    <Scene
                        position={[8, 9, 12]}
                        zoom={45}
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
                            <RainRipples
                                stacks={stacks}
                                gardenId={7}
                                tier={tier}
                                enabled={!disabled}
                                snow={snow}
                            />
                            {mounted && (
                                <ColdWeatherEffects
                                    weather={{
                                        ...weather,
                                        rainy: rain,
                                        snowy: snow,
                                        snowAccumulation: snow * 30,
                                    }}
                                    tier={tier}
                                    enabled={!disabled}
                                />
                            )}
                            {actorIds.map(({ id, index }) => (
                                <ColdWeatherActor key={id} index={index} />
                            ))}
                            <ColdWeatherProbe onSample={reportSample} />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
