import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { autumnArrangements } from '../src/arrangements/autumnArrangements';
import { EntityFactory } from '../src/entities/EntityFactory';
import { createMockGarden } from '../src/hooks/useCurrentGarden';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { Environment } from '../src/scene/Environment';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { createDateForGameTimeOfDay } from '../src/utils/timeOfDay';
import { AutumnArrangementProbe } from './AutumnArrangementProbe';

export function AutumnArrangementFixture({
    arrangementId,
    stage = 'earlyAutumn',
    light = 'day',
    small = false,
}: {
    arrangementId: string;
    stage?: 'earlyAutumn' | 'midAutumn' | 'lateAutumn';
    light?: 'day' | 'overcast' | 'dusk' | 'night';
    small?: boolean;
}) {
    const [ready, setReady] = useState('');
    const arrangement = autumnArrangements.find(
        (entry) => entry.id === arrangementId,
    );
    if (!arrangement)
        throw new Error(`Unknown autumn arrangement: ${arrangementId}`);
    const stacks = useMemo(
        () =>
            Array.from({ length: 16 }, (_, index) => {
                const x = index % 4;
                const z = Math.floor(index / 4);
                return {
                    position: new Vector3(x - 2, 0, z - 2),
                    blocks: arrangement.placements
                        .filter(
                            (placement) =>
                                placement.x === x && placement.z === z,
                        )
                        .sort(
                            (a, b) =>
                                Number(b.entityName === 'Block_Grass') -
                                Number(a.entityName === 'Block_Grass'),
                        )
                        .map((placement) => ({
                            name: placement.entityName,
                            id: placement.id,
                            rotation: placement.rotation,
                        })),
                };
            }),
        [arrangement],
    );
    const client = useMemo(() => {
        const result = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        result.setQueryData(['blocks', 'local'], getLocalSandboxBlockData());
        result.setQueryData(['gardens', 'current', 'summer', 'high-target'], {
            ...createMockGarden('summer', 'default'),
            stacks,
            raisedBeds: [],
        });
        result.setQueryData(['sorts'], []);
        result.setQueryData(['operations'], []);
        result.setQueryData(['currentUser'], null);
        return result;
    }, [stacks]);
    const date = useMemo(() => {
        const noon = getSeasonDebugDates(2026)[stage];
        if (light === 'dusk') return createDateForGameTimeOfDay(noon, 0.8);
        if (light === 'night') noon.setHours(22, 30);
        return noon;
    }, [stage, light]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                mockGardenProfile: 'high-target',
                authenticatedGardenQueriesEnabled: false,
                winterMode: 'summer',
                freezeTime: date,
                dayNightCycleDisabled: false,
            }),
        [date],
    );
    useDisposeGameStateStore(store);
    const quality = gameQualityProfiles[small ? 'low' : 'high'];
    const weather = useMemo(
        () => ({
            cloudy: light === 'overcast' ? 1 : 0,
            foggy: 0,
            rainy: 0,
            snowy: 0,
            snowAccumulation: 0,
            windSpeed: 0,
            windDirection: 0,
        }),
        [light],
    );
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-testid="autumn-arrangement"
                        data-ready={ready}
                        data-date={date.toISOString()}
                        data-autumn={JSON.stringify(
                            store.getState().autumnState,
                        )}
                        style={{
                            width: small ? 390 : 780,
                            height: small ? 440 : 600,
                        }}
                    >
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={small ? 53 : 80}
                            quality={quality}
                            pixelRatio={1}
                            fixedTimeSeconds={12}
                            animateSprings={false}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <Environment
                                quality={quality}
                                weather={weather}
                                noSound
                            />
                            <Suspense fallback={null}>
                                {stacks.flatMap((stack) =>
                                    stack.blocks.map((block) => (
                                        <group
                                            key={block.id}
                                            name={`arrangement:${block.id}`}
                                        >
                                            <EntityFactory
                                                name={block.name}
                                                block={block}
                                                stack={stack}
                                                rotation={block.rotation}
                                                noControl
                                            />
                                        </group>
                                    )),
                                )}
                                <AutumnArrangementProbe
                                    arrangement={arrangement}
                                    onReady={setReady}
                                />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
