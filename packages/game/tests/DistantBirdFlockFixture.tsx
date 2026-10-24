import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DistantBirdFlocks } from '../src/scene/DistantBirdFlocks';
import { createDistantBirdFlockWindow } from '../src/scene/distantBirdFlock';
import { createRuntimeFrameLoopProfileTelemetry } from '../src/scene/gameProfileMetadata';
import type { GameQualityProfileTier } from '../src/scene/gameQuality';
import { SceneTimeProvider } from '../src/scene/SceneTime';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { DistantBirdFlockProbe } from './DistantBirdFlockProbe';

const flockFixtureWindow = createDistantBirdFlockWindow('23:2026-10-22', 0);
const flockFixtureMidpoint =
    flockFixtureWindow.start + flockFixtureWindow.duration / 2;

export function DistantBirdFlockFixture({
    tier = 'high',
    enabled = true,
    mounted = true,
    fixed = flockFixtureMidpoint,
    live = false,
    rain = 0,
    offscreen = false,
    zoom = 17,
    gardenId = 23,
    date = '2026-10-22T12:00:00+02:00',
}: {
    tier?: GameQualityProfileTier;
    enabled?: boolean;
    mounted?: boolean;
    fixed?: number;
    live?: boolean;
    rain?: number;
    offscreen?: boolean;
    zoom?: number;
    gardenId?: number;
    date?: string;
}) {
    const [sample, setSample] = useState('');
    const [disposals, setDisposals] = useState(0);
    const [hits, setHits] = useState(0);
    const onDispose = useCallback(() => setDisposals((count) => count + 1), []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                freezeTime: new Date('2026-10-22T12:00:00+02:00'),
            }),
        [],
    );
    useDisposeGameStateStore(store);
    useEffect(() => {
        store.getState().setFreezeTime(new Date(date));
    }, [store, date]);
    const telemetry = useMemo(createRuntimeFrameLoopProfileTelemetry, []);
    // DOM reads reference the live telemetry object; this probe itself acquires no render lease.
    useEffect(() => {
        Object.assign(window, { flockRuntime: telemetry });
        return () => {
            Reflect.deleteProperty(window, 'flockRuntime');
        };
    }, [telemetry]);
    return (
        <GameStateContext.Provider value={store}>
            <div
                data-testid="distant-flocks"
                data-sample={sample}
                data-disposals={disposals}
                data-hits={hits}
                style={{ marginTop: offscreen ? 2000 : 0 }}
            >
                <Canvas
                    orthographic
                    camera={{ position: [0, 16, -25], zoom }}
                    frameloop="never"
                    style={{ width: 640, height: 420 }}
                >
                    <color attach="background" args={['#c4d5dd']} />
                    <ambientLight intensity={2} />
                    <directionalLight position={[5, 10, -5]} intensity={2} />
                    <SceneTimeProvider
                        baseFramesPerSecond={0}
                        ambientFramesPerSecond={30}
                        fixedTimeSeconds={live ? undefined : fixed}
                        runtimeFrameLoop={telemetry}
                        suspendWhenOffscreen
                    >
                        <mesh
                            rotation-x={-Math.PI / 2}
                            onPointerDown={() => setHits((count) => count + 1)}
                        >
                            <planeGeometry args={[10, 10]} />
                            <meshStandardMaterial color="#657e4d" />
                        </mesh>
                        {mounted && (
                            <DistantBirdFlocks
                                tier={tier}
                                enabled={enabled}
                                gardenId={gardenId}
                                rain={rain}
                            />
                        )}
                        <DistantBirdFlockProbe
                            zoom={zoom}
                            onSample={setSample}
                            onDispose={onDispose}
                            revision={JSON.stringify({
                                tier,
                                enabled,
                                mounted,
                                fixed,
                                live,
                                rain,
                                zoom,
                                gardenId,
                                date,
                            })}
                        />
                    </SceneTimeProvider>
                </Canvas>
            </div>
        </GameStateContext.Provider>
    );
}
