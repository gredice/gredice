import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GameFlagsContext } from '../src/GameFlagsContext';
import { withInternalSceneBlockData } from '../src/internalSceneBlockData';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { loadGameGLTF } from '../src/scene/resources/gameGLTFResources';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { resolveGameAssetModelUrl } from '../src/utils/useGameGLTF';
import { LadybugSuspenseContent } from './LadybugSuspenseContent';
import { LadybugSuspenseProbe } from './LadybugSuspenseProbe';
import {
    createLadybugSuspenseGarden,
    createLadybugSuspenseGate,
} from './ladybugSuspenseWitness';

const flags = { enableDebugHudFlag: true };

export function LadybugSuspenseFixture({
    appBaseUrl,
    night = false,
}: {
    appBaseUrl: string;
    night?: boolean;
}) {
    const output = useRef<HTMLOutputElement>(null);
    const [assetsReady, setAssetsReady] = useState(false);
    const [version, setVersion] = useState(0);
    const [loadError, setLoadError] = useState('');
    const gate = useMemo(createLadybugSuspenseGate, []);
    const garden = useMemo(createLadybugSuspenseGarden, []);
    const lifecycle = useMemo(
        () => ({ mounts: 0, cleanups: 0, live: false }),
        [],
    );
    const queryClient = useMemo(() => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        client.setQueryData(
            ['blocks', 'local'],
            withInternalSceneBlockData(getLocalSandboxBlockData()),
        );
        return client;
    }, []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl,
                authenticatedGardenQueriesEnabled: false,
                isMock: true,
                freezeTime: new Date(
                    night
                        ? '2026-07-15T22:00:00+02:00'
                        : '2026-07-15T12:00:00+02:00',
                ),
            }),
        [appBaseUrl, night],
    );
    useDisposeGameStateStore(store);
    useEffect(() => {
        let mounted = true;
        loadGameGLTF(resolveGameAssetModelUrl(appBaseUrl, 'Ladybug')).then(
            () => {
                if (mounted) setAssetsReady(true);
            },
            (error: unknown) => {
                if (mounted) setLoadError(String(error));
            },
        );
        return () => {
            mounted = false;
        };
    }, [appBaseUrl]);
    return (
        <QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={store}>
                <GameFlagsContext.Provider value={flags}>
                    <button
                        type="button"
                        onClick={() => {
                            gate.suspend();
                            setVersion(version + 1);
                        }}
                    >
                        Suspend late resource
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            gate.reveal();
                            setVersion(version + 1);
                        }}
                    >
                        Reveal late resource
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            store.getState().triggerAnimalDebugBehavior({
                                species: 'Ladybug',
                                behavior: 'flight',
                            })
                        }
                    >
                        Take flight
                    </button>
                    <button
                        type="button"
                        onClick={() => store.setState({ timeOfDay: 0.9 })}
                    >
                        Night
                    </button>
                    <output
                        ref={output}
                        data-testid="ladybug-suspense-sample"
                        data-version={version}
                    >
                        {loadError || String(assetsReady)}
                    </output>
                    <div style={{ width: 640, height: 480 }}>
                        <Scene
                            position={[0, 6, 8]}
                            zoom={160}
                            pixelRatio={1}
                            quality={gameQualityProfiles.high}
                            staticOpaqueCacheEnabled={false}
                            adaptiveHighEnabled={false}
                            animateSprings={false}
                            rendererOptions={{ preserveDrawingBuffer: true }}
                        >
                            <ambientLight intensity={2} />
                            <LadybugSuspenseProbe
                                output={output}
                                store={store}
                                lifecycle={lifecycle}
                            />
                            <group name="ladybug-suspense-witness">
                                {assetsReady && (
                                    <Suspense fallback={null}>
                                        <LadybugSuspenseContent
                                            garden={garden}
                                            gate={gate}
                                            lifecycle={lifecycle}
                                        />
                                    </Suspense>
                                )}
                            </group>
                        </Scene>
                    </div>
                </GameFlagsContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
