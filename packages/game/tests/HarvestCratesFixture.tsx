import { useFrame, useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Mesh, Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import { EntityInstances } from '../src/entities/EntityInstances';
import { createMockGarden } from '../src/hooks/useCurrentGarden';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { Environment } from '../src/scene/Environment';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';

function CrateProbe({ onReady }: { onReady: (value: string) => void }) {
    const { scene, camera, size } = useThree();
    const frames = useRef(0);
    const reported = useRef(false);
    useSceneTimeInvalidation('test:crates-ready', !reported.current);
    useLayoutEffect(() => {
        camera.lookAt(0, 0.5, 0.5);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        if (++frames.current < 30 || reported.current) return;
        scene.updateMatrixWorld(true);
        const crates = [
            'pumpkins-ground',
            'orchard-ground',
            'pumpkins-table',
            'orchard-table',
        ].map((id) => {
            const object = scene.getObjectByName(`HarvestCrate:${id}`);
            if (!object) throw new Error(`Missing runtime crate ${id}`);
            const bounds = new Box3().setFromObject(object);
            const point = bounds.getCenter(new Vector3()).project(camera);
            let meshes = 0;
            object.traverse((node) => {
                if (node instanceof Mesh) meshes++;
            });
            return {
                id,
                meshes,
                rotationY: object.rotation.y,
                minY: bounds.min.y,
                height: bounds.max.y - bounds.min.y,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        reported.current = true;
        onReady(JSON.stringify(crates));
    });
    return null;
}

export function HarvestCratesFixture({
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
    const stacks = useMemo(
        () =>
            Array.from({ length: 12 }, (_, index) => {
                const x = (index % 3) - 1;
                const z = Math.floor(index / 3) - 1;
                return {
                    position: new Vector3(x, 0, z),
                    blocks: [
                        {
                            name: 'Block_Grass',
                            id: `ground:${index}`,
                            rotation: 0,
                        },
                        ...((x === 0 && z === -1) ||
                        (Math.abs(x) === 1 && z === 2)
                            ? [
                                  {
                                      name: 'OutletDisplayTable',
                                      id: `table:${index}`,
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(Math.abs(x) === 1 && (z === -1 || z === 2)
                            ? [
                                  {
                                      name:
                                          x === -1
                                              ? 'HarvestCrate'
                                              : 'HarvestCrateOrchard',
                                      id: `${x === -1 ? 'pumpkins' : 'orchard'}-${z === -1 ? 'ground' : 'table'}`,
                                      rotation,
                                  },
                              ]
                            : []),
                    ],
                };
            }),
        [rotation],
    );
    const client = useMemo(() => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        queryClient.setQueryData(
            ['blocks', 'local'],
            getLocalSandboxBlockData(),
        );
        queryClient.setQueryData(['gardens', 'current', 'summer', 'default'], {
            ...createMockGarden('summer', 'default'),
            stacks,
            raisedBeds: [],
        });
        queryClient.setQueryData(['sorts'], []);
        queryClient.setQueryData(['operations'], []);
        queryClient.setQueryData(['currentUser'], null);
        return queryClient;
    }, [stacks]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                authenticatedGardenQueriesEnabled: false,
                winterMode: 'summer',
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
                        data-testid="harvest-crates"
                        data-ready={ready}
                        data-hit={hit}
                        style={{
                            width: small ? 390 : 680,
                            height: small ? 440 : 520,
                            position: 'relative',
                        }}
                    >
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={small ? 52 : 82}
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
                                {stacks.flatMap((stack) =>
                                    stack.blocks.slice(1).map((block) => (
                                        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js ray-selection target, not a DOM control.
                                        <group
                                            key={block.id}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setHit(block.id);
                                            }}
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
                                <CrateProbe onReady={setReady} />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
