import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useMemo, useRef, useState } from 'react';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { SceneQueryDataCacheProbe } from './SceneQueryDataCacheProbe';
import { SceneQueryDataContent } from './SceneQueryDataContent';
import { SceneQueryDataProbe } from './SceneQueryDataProbe';
import { SceneQueryDataScope } from './SceneQueryDataScope';
import {
    createSceneQueryData,
    createSceneQueryGate,
    type SceneQueryDataMode,
} from './sceneQueryDataWitness';

export function SceneQueryDataRoot({
    id,
    mode,
    height,
    leafCount,
    cacheData,
    remote,
    initiallySuspended,
}: {
    id: string;
    mode: SceneQueryDataMode;
    height: number;
    leafCount: number;
    cacheData: 'seeded' | 'empty' | 'null';
    remote: boolean;
    initiallySuspended: boolean;
}) {
    const output = useRef<HTMLOutputElement>(null);
    const [live, setLive] = useState(true);
    const [, setVersion] = useState(0);
    const [supplied, setSupplied] = useState(() =>
        createSceneQueryData(height),
    );
    const gate = useMemo(
        () => createSceneQueryGate(initiallySuspended),
        [initiallySuspended],
    );
    const client = useMemo(() => {
        const next = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        if (cacheData !== 'empty') {
            next.setQueryData(
                ['blocks', 'local'],
                cacheData === 'null' ? null : createSceneQueryData(height),
            );
            next.setQueryData(['blocks'], createSceneQueryData(height + 3));
        }
        return next;
    }, [cacheData, height]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                authenticatedGardenQueriesEnabled: false,
                isMock: !remote,
                freezeTime: new Date('2026-07-15T12:00:00+02:00'),
            }),
        [remote],
    );
    useDisposeGameStateStore(store);
    return (
        <section data-testid={`scene-query-root-${id}`}>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <button type="button" onClick={() => setLive(!live)}>
                        {live ? 'Unmount scene' : 'Mount scene'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const key = store.getState().isMock
                                ? ['blocks', 'local']
                                : ['blocks'];
                            client.setQueryData(key, createSceneQueryData(7));
                        }}
                    >
                        Cache height 7
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            client.invalidateQueries({
                                queryKey: store.getState().isMock
                                    ? ['blocks', 'local']
                                    : ['blocks'],
                                exact: true,
                            })
                        }
                    >
                        Invalidate block query
                    </button>
                    <button
                        type="button"
                        onClick={() => setSupplied(createSceneQueryData(7))}
                    >
                        Supplied height 7
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            store.setState({ isMock: !store.getState().isMock })
                        }
                    >
                        Switch local or remote key
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            gate.suspend();
                            setVersion((old) => old + 1);
                        }}
                    >
                        Suspend children
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            gate.reveal();
                            setVersion((old) => old + 1);
                        }}
                    >
                        Reveal children
                    </button>
                    <SceneQueryDataCacheProbe client={client} />
                    <output ref={output} data-testid="scene-query-sample" />
                    <output hidden data-testid="scene-query-remote-response">
                        {JSON.stringify(createSceneQueryData(3))}
                    </output>
                    <div style={{ width: 400, height: 320 }}>
                        {live && (
                            <SceneQueryDataScope mode={mode} data={supplied}>
                                <Scene
                                    position={[10, 15, 20]}
                                    zoom={25}
                                    pixelRatio={1}
                                    quality={gameQualityProfiles.low}
                                    staticOpaqueCacheEnabled={false}
                                    adaptiveHighEnabled={false}
                                    animateSprings={false}
                                    baseFramesPerSecond={30}
                                    suspendWhenOffscreen={false}
                                    rendererOptions={{
                                        preserveDrawingBuffer: true,
                                    }}
                                >
                                    <SceneQueryDataProbe output={output} />
                                    <Suspense
                                        fallback={
                                            <group name="scene-query-fallback" />
                                        }
                                    >
                                        <SceneQueryDataContent
                                            mode={mode}
                                            gate={gate}
                                            leafCount={leafCount}
                                        />
                                    </Suspense>
                                </Scene>
                            </SceneQueryDataScope>
                        )}
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </section>
    );
}
