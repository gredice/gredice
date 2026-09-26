import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EntityInstances } from '../src/entities/EntityInstances';
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
    tier = 'high',
    rain = 1,
    snow = 0,
    disabled = false,
    mounted = true,
    live = false,
    precipitation = false,
    date = 'lateAutumn',
    fixedTime = 12,
}: {
    tier?: GameQualityTier;
    rain?: number;
    snow?: number;
    disabled?: boolean;
    mounted?: boolean;
    live?: boolean;
    precipitation?: boolean;
    date?: 'summer' | 'lateAutumn' | 'winter';
    fixedTime?: number;
}) {
    const [sample, setSample] = useState('{}');
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
        });
    }, [store, disabled, rain, snow]);
    const stacks = useMemo(
        () =>
            Array.from({ length: 99 }, (_, i) => {
                const x = (i % 11) - 5;
                const z = Math.floor(i / 11) - 4;
                return {
                    position: new Vector3(x, 0, z),
                    blocks: [
                        {
                            name: i % 2 ? 'Block_Sand' : 'Block_Swamp_Ground',
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
                    data-testid="rain-ripple-scene"
                    data-sample={sample}
                    style={{ width: 900, height: 640 }}
                >
                    <Scene
                        position={[8, 9, 12]}
                        zoom={65}
                        quality={gameQualityProfiles[tier]}
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
                                <RainRipples
                                    stacks={stacks}
                                    gardenId={7}
                                    tier={tier}
                                    enabled={!disabled}
                                    snow={snow}
                                />
                            )}
                            <RainRippleProbe onSample={setSample} />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
