import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    createRuntimeFrameLoopProfileTelemetry,
    updateGameProfileMetadata,
} from '../src/scene/gameProfileMetadata';
import type { GameQualityProfileTier } from '../src/scene/gameQuality';
import { LocalizedSteam } from '../src/scene/LocalizedSteam';
import { SceneTimeProvider } from '../src/scene/SceneTime';
import { SteamEmitter } from '../src/scene/SteamEmitter';
import { SteamSourcesProvider } from '../src/scene/SteamSources';
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
}: {
    tier?: GameQualityProfileTier;
    emitters?: number;
    enabled?: boolean;
    mounted?: boolean;
    fixed?: number;
    offscreen?: boolean;
}) {
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
                        <SteamSourcesProvider>
                            <group position-x={offscreen ? 100 : 0}>
                                {Array.from(
                                    { length: emitters },
                                    (_, index) => (
                                        <SteamEmitter
                                            // biome-ignore lint/suspicious/noArrayIndexKey: Synthetic emitter IDs are stable slot numbers.
                                            key={index}
                                            id={`fixture:${index}`}
                                            position={[index * 0.05, 0, 0]}
                                            radius={0.035}
                                        />
                                    ),
                                )}
                            </group>
                            {mounted && (
                                <LocalizedSteam tier={tier} enabled={enabled} />
                            )}
                            <SteamResourceProbe onDispose={onDispose} />
                            {fixed !== undefined && (
                                <SteamProbe onSample={setSample} />
                            )}
                        </SteamSourcesProvider>
                    </SceneTimeProvider>
                </Canvas>
            </div>
        </GameStateContext.Provider>
    );
}
