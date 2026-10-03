import { Canvas } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { ChestnutRoastingCart } from '../src/entities/ChestnutRoastingCart';
import { GardenTeaTable } from '../src/entities/GardenTeaTable';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import {
    createRuntimeFrameLoopProfileTelemetry,
    updateGameProfileMetadata,
} from '../src/scene/gameProfileMetadata';
import type { GameQualityProfileTier } from '../src/scene/gameQuality';
import { LocalizedSteam } from '../src/scene/LocalizedSteam';
import { SceneTimeProvider } from '../src/scene/SceneTime';
import { SteamEmitter } from '../src/scene/SteamEmitter';
import { SteamSourcesProvider } from '../src/scene/SteamSources';
import { WeatherSurfaceUniformProvider } from '../src/scene/WeatherSurfaceUniformProvider';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { SteamProbe } from './SteamProbe';
import { SteamResourceProbe } from './SteamResourceProbe';

export function SteamLifecycleFixture({
    tier = 'high',
    emitters = 20,
    enabled = true,
    mounted = true,
    fixed,
    offscreen = false,
    realProps = false,
}: {
    tier?: GameQualityProfileTier;
    emitters?: number;
    enabled?: boolean;
    mounted?: boolean;
    fixed?: number;
    offscreen?: boolean;
    realProps?: boolean;
}) {
    const client = useMemo(() => {
        const value = new QueryClient();
        value.setQueryData(['blocks', 'local'], getLocalSandboxBlockData());
        return value;
    }, []);
    const [disposals, setDisposals] = useState(0);
    const [sample, setSample] = useState('');
    const onDispose = useCallback(() => setDisposals((count) => count + 1), []);
    const store = useMemo(
        () =>
            createGameState({ appBaseUrl: '', isMock: true, freezeTime: null }),
        [],
    );
    useDisposeGameStateStore(store);
    const telemetry = useMemo(createRuntimeFrameLoopProfileTelemetry, []);
    useEffect(() => {
        updateGameProfileMetadata({ runtimeFrameLoop: telemetry });
        return () => updateGameProfileMetadata({ runtimeFrameLoop: undefined });
    }, [telemetry]);
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <div
                    data-testid="steam-lifecycle"
                    data-disposals={disposals}
                    data-sample={sample}
                >
                    <Canvas
                        orthographic
                        camera={{ position: [0, 1, 4], zoom: 90 }}
                        frameloop="never"
                        style={{ width: 640, height: 420 }}
                    >
                        <SceneTimeProvider
                            ambientFramesPerSecond={30}
                            baseFramesPerSecond={0}
                            fixedTimeSeconds={fixed}
                            runtimeFrameLoop={telemetry}
                            suspendWhenOffscreen
                        >
                            <WeatherSurfaceUniformProvider>
                                <SteamSourcesProvider>
                                    <group position-x={offscreen ? 100 : 0}>
                                        <Suspense fallback={null}>
                                            {realProps
                                                ? Array.from(
                                                      { length: emitters },
                                                      (_, index) => {
                                                          const cart =
                                                              index % 2 === 0;
                                                          const block = {
                                                              name: cart
                                                                  ? 'ChestnutRoastingCart'
                                                                  : 'GardenTeaTable',
                                                              id: `real:${index}`,
                                                              rotation: 0,
                                                          };
                                                          const stack = {
                                                              position:
                                                                  new Vector3(
                                                                      (index %
                                                                          3) -
                                                                          1,
                                                                      -0.5,
                                                                      Math.floor(
                                                                          index /
                                                                              3,
                                                                      ) - 1,
                                                                  ),
                                                              blocks: [block],
                                                          };
                                                          return cart ? (
                                                              <ChestnutRoastingCart
                                                                  key={block.id}
                                                                  block={block}
                                                                  stack={stack}
                                                                  rotation={0}
                                                              />
                                                          ) : (
                                                              <GardenTeaTable
                                                                  key={block.id}
                                                                  block={block}
                                                                  stack={stack}
                                                                  rotation={0}
                                                              />
                                                          );
                                                      },
                                                  )
                                                : Array.from(
                                                      { length: emitters },
                                                      (_, index) => (
                                                          <SteamEmitter
                                                              // biome-ignore lint/suspicious/noArrayIndexKey: Synthetic emitter IDs are stable slot numbers.
                                                              key={index}
                                                              id={`fixture:${index}`}
                                                              position={[
                                                                  index * 0.05,
                                                                  0,
                                                                  0,
                                                              ]}
                                                              radius={0.035}
                                                          />
                                                      ),
                                                  )}
                                        </Suspense>
                                    </group>
                                    {mounted && (
                                        <LocalizedSteam
                                            tier={tier}
                                            enabled={enabled}
                                        />
                                    )}
                                    <SteamResourceProbe onDispose={onDispose} />
                                    {fixed !== undefined && (
                                        <SteamProbe onSample={setSample} />
                                    )}
                                </SteamSourcesProvider>
                            </WeatherSurfaceUniformProvider>
                        </SceneTimeProvider>
                    </Canvas>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
