import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EntityInstances } from '../src/entities/EntityInstances';
import { Tree } from '../src/entities/Tree';
import { AutumnLeaves } from '../src/scene/AutumnLeaves';
import type { GameQualityTier } from '../src/scene/gameQuality';
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
    instanced = false,
    zoom = 95,
    leaves = false,
    wind = 3,
    tier = 'high',
    ground = false,
}: {
    stage?: keyof ReturnType<typeof getSeasonDebugDates>;
    disabled?: boolean;
    snow?: number;
    lighting?: 'day' | 'twilight' | 'cloudy';
    zoom?: number;
    leaves?: boolean;
    wind?: number;
    tier?: GameQualityTier;
    instanced?: boolean;
    ground?: boolean;
}) {
    const [ready, setReady] = useState('');
    const [leafCount, setLeafCount] = useState(0);
    const [groundCount, setGroundCount] = useState(0);
    const stacks = useMemo(
        () =>
            [-1.4, 0, 1.4].map((x, index) => ({
                position: new Vector3(x, 0, 0),
                blocks: [
                    ...(ground
                        ? [
                              {
                                  name:
                                      index === 2
                                          ? 'Block_Grass_Angle'
                                          : 'Block_Grass',
                                  id: `ground:${index}`,
                                  rotation: index,
                              },
                          ]
                        : []),
                    {
                        name: 'Tree',
                        id: `autumn-fixture:${index}`,
                        rotation: 0,
                    },
                ],
            })),
        [ground],
    );
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
                    data-leaves={leafCount}
                    data-ground-leaves={groundCount}
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
                        {leaves && (
                            <AutumnLeaves
                                tier={tier}
                                windSpeed={wind}
                                windDirection={90}
                                enabled={!disabled}
                            />
                        )}
                        <Suspense fallback={null}>
                            {instanced ? (
                                <EntityInstances
                                    stacks={stacks}
                                    quality={
                                        gameQualityProfiles[
                                            ground ? tier : 'low'
                                        ]
                                    }
                                    renderGroundDecorations={false}
                                />
                            ) : (
                                stacks.map((stack) => (
                                    <Tree
                                        key={stack.blocks[0].id}
                                        stack={stack}
                                        block={stack.blocks[0]}
                                        rotation={0}
                                    />
                                ))
                            )}
                            <AutumnSceneProbe
                                onReady={setReady}
                                onLeafCount={setLeafCount}
                                onGroundCount={setGroundCount}
                            />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
