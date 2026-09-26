import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from '../src/entities/EntityInstances';
import { createMockGarden } from '../src/hooks/useCurrentGarden';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { ParticleSystemProvider } from '../src/particles/ParticleSystem';
import { Environment } from '../src/scene/Environment';
import {
    type GameQualityTier,
    gameQualityProfiles,
} from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { SteamProfileProbe } from './SteamProfileProbe';

export function SteamProfileFixture({
    tier,
    steam,
}: {
    tier: GameQualityTier;
    steam: boolean;
}) {
    const [report, setReport] = useState('');
    const garden = useMemo(() => {
        const mock = createMockGarden('summer', 'dense-autumn');
        mock.stacks = mock.stacks.filter(
            ({ position }) =>
                Math.abs(position.x) <= 7 && Math.abs(position.z) <= 7,
        );
        for (const stack of mock.stacks) {
            if (
                Math.abs(stack.position.x) === 2 &&
                Math.abs(stack.position.z) === 2
            ) {
                stack.blocks.push({
                    name: 'GardenTeaTable',
                    id: `profile-tea:${stack.position.x}:${stack.position.z}`,
                    rotation: 0,
                });
            }
        }
        return mock;
    }, []);
    const stacks = useMemo(
        () =>
            garden.stacks.map((stack) => ({
                ...stack,
                position: new Vector3(
                    stack.position.x,
                    stack.position.y,
                    stack.position.z,
                ),
            })),
        [garden],
    );
    const client = useMemo(() => {
        const value = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        value.setQueryData(['blocks', 'local'], getLocalSandboxBlockData());
        value.setQueryData(
            ['gardens', 'current', 'summer', 'dense-autumn'],
            garden,
        );
        value.setQueryData(['sorts'], []);
        value.setQueryData(['operations'], []);
        value.setQueryData(['currentUser'], null);
        return value;
    }, [garden]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                authenticatedGardenQueriesEnabled: false,
                winterMode: 'summer',
                mockGardenProfile: 'dense-autumn',
                freezeTime: new Date('2026-10-22T12:00:00+02:00'),
            }),
        [],
    );
    useDisposeGameStateStore(store);
    const quality = gameQualityProfiles[tier];
    const weather = {
        cloudy: 0.3,
        foggy: 0,
        rainy: 0,
        snowy: 0,
        snowAccumulation: 0,
        windSpeed: 3,
        windDirection: 90,
    };
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-testid="steam-profile"
                        data-report={report}
                        style={{ width: 680, height: 520 }}
                    >
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={25}
                            quality={quality}
                            pixelRatio={1}
                            frameloop="always"
                            animateSprings={false}
                        >
                            <Environment
                                quality={quality}
                                weather={weather}
                                noSound
                            />
                            <ParticleSystemProvider>
                                <Suspense fallback={null}>
                                    <EntityInstances
                                        stacks={stacks}
                                        quality={quality}
                                        weather={weather}
                                    />
                                    {stacks.flatMap((stack) =>
                                        stack.blocks
                                            .filter(
                                                (block) =>
                                                    !instancedBlockNames.includes(
                                                        block.name,
                                                    ),
                                            )
                                            .map((block) => (
                                                <EntityFactory
                                                    key={block.id}
                                                    name={block.name}
                                                    block={block}
                                                    stack={stack}
                                                    rotation={block.rotation}
                                                    noControl
                                                />
                                            )),
                                    )}
                                </Suspense>
                            </ParticleSystemProvider>
                            <SteamProfileProbe
                                enabled={steam}
                                onReport={setReport}
                            />
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
