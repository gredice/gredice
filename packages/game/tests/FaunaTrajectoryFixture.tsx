import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import type { GameAssetName } from '../src/data/models';
import { createAllAnimalDebugStacks } from '../src/entities/animals/allAnimalDebugStacks';
import type { PollinatorGarden } from '../src/entities/pollinators/flowerTargets';
import { GameFlagsContext } from '../src/GameFlagsContext';
import { withInternalSceneBlockData } from '../src/internalSceneBlockData';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { ParticleSystemProvider } from '../src/particles/ParticleSystem';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { loadGameGLTF } from '../src/scene/resources/gameGLTFResources';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { resolveGameAssetModelUrl } from '../src/utils/useGameGLTF';
import { FaunaTrajectoryActors } from './FaunaTrajectoryActors';
import { FaunaTrajectoryDriver } from './FaunaTrajectoryDriver';
import { activateFaunaPoseOracle } from './faunaPoseOracle';
import type { FaunaTrajectoryScenario } from './faunaTrajectoryState';

const flags = { enableDebugHudFlag: true };

export function FaunaTrajectoryFixture({
    appBaseUrl,
    scenario,
    mode = 'candidate',
}: {
    appBaseUrl: string;
    scenario: FaunaTrajectoryScenario;
    mode?: 'baseline' | 'candidate';
}) {
    const poseOracle = useMemo(() => activateFaunaPoseOracle(mode), [mode]);
    useEffect(() => poseOracle.dispose, [poseOracle]);
    const [assetsReady, setAssetsReady] = useState(false);
    const [wet, setWet] = useState(scenario === 'autumn-post-rain');
    const [loadError, setLoadError] = useState('');
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
                    scenario === 'night'
                        ? '2026-07-15T22:00:00+02:00'
                        : scenario === 'autumn-post-rain'
                          ? '2026-10-22T12:00:00+02:00'
                          : '2026-07-15T12:00:00+02:00',
                ),
            }),
        [appBaseUrl, scenario],
    );
    useDisposeGameStateStore(store);
    const garden = useMemo<PollinatorGarden>(() => {
        const stacks = createAllAnimalDebugStacks().map((stack) => ({
            ...stack,
            blocks: stack.blocks.map((block) => ({ ...block })),
            position: new Vector3(
                stack.position.x,
                stack.position.y,
                stack.position.z,
            ),
        }));
        for (const stack of stacks) {
            if (
                stack.position.x >= 3 &&
                stack.position.x <= 4 &&
                stack.position.z <= -2
            )
                stack.blocks[0].name = 'Block_Swamp_Water';
            if (stack.position.x === -3 && stack.position.z === 0)
                stack.blocks.push({
                    id: 'witness-bed',
                    name: 'Raised_Bed',
                    rotation: 0,
                });
        }
        return {
            id: 99995,
            stacks,
            raisedBeds: [
                {
                    id: 4715,
                    blockId: 'witness-bed',
                    fields: [
                        {
                            active: true,
                            plantSortId: 337,
                            plantStatus: 'ready',
                            positionIndex: 0,
                        },
                    ],
                },
            ],
        };
    }, []);
    const weather = useMemo(
        () => ({
            temperature: 18,
            cloudy: 0,
            rainy: wet ? 0.7 : 0,
            snowy: 0,
            foggy: 0,
        }),
        [wet],
    );
    useEffect(() => {
        store.setState({
            rainSurfaceIntensity: wet ? 0.7 : 0,
            weather,
            weatherVisualizationDisabled: false,
        });
    }, [store, weather, wet]);
    useEffect(() => {
        let active = true;
        const assets = [
            'Cow',
            'Cat',
            'Dog',
            'BirdSmall',
            'Bee',
            'Bat',
            'Butterfly',
            'Ladybug',
            'Frog',
            'Horse',
            'Rabbit',
            'Squirrel',
            'Slug',
            'Chicken',
            'Goat',
            'Piglet',
            'Sheep',
        ] satisfies GameAssetName[];
        Promise.all(
            assets.map((asset) =>
                loadGameGLTF(resolveGameAssetModelUrl(appBaseUrl, asset)),
            ),
        ).then(
            () => {
                if (active) setAssetsReady(true);
            },
            (error: unknown) => {
                if (active) setLoadError(String(error));
            },
        );
        return () => {
            active = false;
        };
    }, [appBaseUrl]);
    return (
        <QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={store}>
                <GameFlagsContext.Provider value={flags}>
                    <button
                        type="button"
                        data-testid="fauna-after-rain"
                        onClick={() => setWet(false)}
                    >
                        After rain
                    </button>
                    <output data-testid="fauna-assets-ready">
                        {loadError || String(assetsReady)}
                    </output>
                    <div
                        data-testid="fauna-trajectory-root"
                        style={{ width: 640, height: 480 }}
                    >
                        <Scene
                            position={[0, 20, 10]}
                            zoom={35}
                            pixelRatio={1}
                            quality={gameQualityProfiles.high}
                            frameloop="never"
                            staticOpaqueCacheEnabled={false}
                            adaptiveHighEnabled={false}
                            animateSprings={false}
                            continuousRenderLeasesEnabled={false}
                        >
                            <ambientLight intensity={2} />
                            <ParticleSystemProvider>
                                <FaunaTrajectoryDriver
                                    assetsReady={assetsReady}
                                    scenario={scenario}
                                    poseOracle={poseOracle.oracle}
                                />
                                {assetsReady ? (
                                    <Suspense fallback={null}>
                                        <FaunaTrajectoryActors
                                            garden={garden}
                                            weather={weather}
                                        />
                                    </Suspense>
                                ) : null}
                            </ParticleSystemProvider>
                        </Scene>
                    </div>
                </GameFlagsContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
