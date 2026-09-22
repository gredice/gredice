import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { Tree } from '../src/entities/Tree';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { AutumnSceneProbe } from './AutumnSceneProbe';

export function AutumnVisualFixture({
    stage = 'midAutumn',
    disabled = false,
    snow = 0,
    lighting = 'day',
    zoom = 95,
}: {
    stage?: keyof ReturnType<typeof getSeasonDebugDates>;
    disabled?: boolean;
    snow?: number;
    lighting?: 'day' | 'twilight' | 'cloudy';
    zoom?: number;
}) {
    const [ready, setReady] = useState('');
    const client = useMemo(() => new QueryClient(), []);
    const store = useMemo(() => {
        const next = createGameState({
            appBaseUrl: '',
            isMock: true,
            freezeTime: getSeasonDebugDates()[stage],
        });
        next.setState({
            weatherVisualizationDisabled: disabled,
            snowCoverage: snow,
        });
        return next;
    }, [stage, disabled, snow]);
    useDisposeGameStateStore(store);
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <div
                    data-testid="autumn-scene"
                    data-canopies={ready}
                    style={{ width: 640, height: 420 }}
                >
                    <Scene
                        position={[4, 4, 6]}
                        zoom={zoom}
                        quality={gameQualityProfiles.low}
                        fixedTimeSeconds={12}
                        animateSprings={false}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <color attach="background" args={['#e7e2cc']} />
                        <ambientLight
                            intensity={lighting === 'twilight' ? 0.45 : 1.5}
                        />
                        <directionalLight
                            position={[4, 8, 3]}
                            intensity={
                                lighting === 'cloudy'
                                    ? 0.4
                                    : lighting === 'twilight'
                                      ? 0.6
                                      : 2
                            }
                            color={
                                lighting === 'twilight' ? '#efac78' : '#ffffff'
                            }
                        />
                        <Suspense fallback={null}>
                            {[-1.4, 0, 1.4].map((x, index) => {
                                const block = {
                                    name: 'Tree',
                                    id: `autumn-fixture:${index}`,
                                    rotation: 0,
                                };
                                return (
                                    <Tree
                                        key={block.id}
                                        stack={{
                                            position: new Vector3(x, 0, 0),
                                            blocks: [block],
                                        }}
                                        block={block}
                                        rotation={0}
                                    />
                                );
                            })}
                            <AutumnSceneProbe onReady={setReady} />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
