import { harvestPumpkins } from '@gredice/js/harvestPumpkins';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import { EntityInstances } from '../src/entities/EntityInstances';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { Environment } from '../src/scene/Environment';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { HarvestPumpkinProbe } from './HarvestPumpkinProbe';

export function HarvestPumpkinFixture({
    rotation,
    night = false,
    small = false,
}: {
    rotation: number;
    night?: boolean;
    small?: boolean;
}) {
    const [ready, setReady] = useState('');
    const [hit, setHit] = useState('');
    const client = useMemo(() => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(
            ['blocks', 'local'],
            getLocalSandboxBlockData(),
        );
        return queryClient;
    }, []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                authenticatedGardenQueriesEnabled: false,
                freezeTime: new Date(
                    night
                        ? '2026-09-23T22:30:00+02:00'
                        : '2026-09-23T12:00:00+02:00',
                ),
                dayNightCycleDisabled: false,
            }),
        [night],
    );
    useDisposeGameStateStore(store);
    const stacks = useMemo(
        () =>
            harvestPumpkins.map((item, index) => ({
                position: new Vector3(
                    (index % 3) - 1,
                    0,
                    Math.floor(index / 3) - 1,
                ),
                blocks: [
                    {
                        name: 'Block_Grass',
                        id: `ground:${item.name}`,
                        rotation: 0,
                    },
                    { name: item.name, id: item.name, rotation },
                ],
            })),
        [rotation],
    );
    const quality = gameQualityProfiles[small ? 'low' : 'high'];
    const weather = {
        cloudy: 0,
        foggy: 0,
        rainy: 0,
        snowy: 0,
        snowAccumulation: 0,
        windSpeed: 0,
        windDirection: 0,
    };
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-testid="pumpkins"
                        data-ready={ready}
                        data-hit={hit}
                        style={{
                            width: small ? 390 : 680,
                            height: small ? 440 : 520,
                        }}
                    >
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={small ? 62 : 90}
                            quality={quality}
                            pixelRatio={1}
                            fixedTimeSeconds={12}
                            frameloop="always"
                            animateSprings={false}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <Environment
                                quality={quality}
                                weather={weather}
                                noSound
                            />
                            <Suspense fallback={null}>
                                <EntityInstances
                                    stacks={stacks}
                                    quality={quality}
                                    weather={weather}
                                />
                                {stacks.map((stack) => (
                                    // biome-ignore lint/a11y/noStaticElementInteractions: Three.js scene group used to verify mesh ray selection, not a DOM control.
                                    <group
                                        key={stack.blocks[1].id}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setHit(stack.blocks[1].name);
                                        }}
                                    >
                                        <EntityFactory
                                            name={stack.blocks[1].name}
                                            block={stack.blocks[1]}
                                            stack={stack}
                                            rotation={rotation}
                                            noControl
                                        />
                                    </group>
                                ))}
                                <HarvestPumpkinProbe onReady={setReady} />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
