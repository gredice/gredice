import { Html } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import { EntityInstances } from '../src/entities/EntityInstances';
import { Hedgehogs } from '../src/entities/hedgehogs/Hedgehogs';
import { RaisedBedPlantField } from '../src/entities/raisedBed/RaisedBedPlantField';
import { createMockGarden } from '../src/hooks/useCurrentGarden';
import { RaisedBedFieldItemButton } from '../src/hud/raisedBed/RaisedBedFieldItemButton';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { Environment } from '../src/scene/Environment';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { createDateForGameTimeOfDay } from '../src/utils/timeOfDay';
import { HedgehogRuntimeProbe } from './HedgehogRuntimeProbe';

import { HedgehogShelterProbe } from './HedgehogShelterProbe';

export function HedgehogShelterFixture({
    rotation,
    light = 'day',
    small = false,
    raised = false,
    reviewSeconds = 8,
    date,
    live = false,
    offscreen = false,
    visitors = true,
    runtime = false,
    closeUp = false,
    blockedEntrance = false,
}: {
    rotation: number;
    light?: 'day' | 'night' | 'dusk' | 'cloudy' | 'rain' | 'snow';
    small?: boolean;
    raised?: boolean;
    reviewSeconds?: number;
    date?: string;
    live?: boolean;
    offscreen?: boolean;
    visitors?: boolean;
    runtime?: boolean;
    closeUp?: boolean;
    blockedEntrance?: boolean;
}) {
    const [ready, setReady] = useState('');
    const [report, setReport] = useState('');
    const [hit, setHit] = useState('');
    const [plantClicks, setPlantClicks] = useState(0);
    const stacks = useMemo(
        () =>
            Array.from({ length: 16 }, (_, index) => {
                const x = (index % 4) - 2;
                const z = Math.floor(index / 4) - 2;
                return {
                    position: new Vector3(x, 0, z),
                    blocks: [
                        {
                            name: 'Block_Grass',
                            id: `ground:${index}`,
                            rotation: 0,
                        },
                        ...(raised && x === -2 && z === -1
                            ? [
                                  {
                                      name: 'OutletDisplayTable',
                                      id: `table:${index}`,
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(blockedEntrance && x === -2 && z === -2
                            ? [
                                  {
                                      name: 'Block_Water',
                                      id: 'water',
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(x === -2 && z === -1
                            ? [
                                  {
                                      name: 'HedgehogShelter',
                                      id: 'shelter',
                                      rotation,
                                  },
                              ]
                            : []),
                        ...(x === -1 && z === 1
                            ? [
                                  {
                                      name: 'BirdHouse',
                                      id: 'bench',
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(x === -1 && z === (raised ? -1 : 0)
                            ? [
                                  {
                                      name: 'WoodenHandLantern',
                                      id: 'lantern',
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(x === 0 && z === -1
                            ? [{ name: 'Raised_Bed', id: 'bed', rotation: 0 }]
                            : []),
                    ],
                };
            }),
        [rotation, raised, blockedEntrance],
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
                freezeTime: date
                    ? new Date(date)
                    : light === 'dusk'
                      ? createDateForGameTimeOfDay(
                            new Date('2026-09-23T12:00:00+02:00'),
                            0.8,
                        )
                      : new Date(
                            light === 'night'
                                ? '2026-09-23T22:30:00+02:00'
                                : '2026-09-23T12:00:00+02:00',
                        ),
                dayNightCycleDisabled: false,
            }),
        [light, date],
    );
    useDisposeGameStateStore(store);
    const quality = gameQualityProfiles[small ? 'low' : 'high'];
    const weather = {
        cloudy: ['cloudy', 'rain', 'snow'].includes(light) ? 1 : 0,
        foggy: 0,
        rainy: light === 'rain' ? 2 : 0,
        snowy: light === 'snow' ? 1 : 0,
        snowAccumulation: light === 'snow' ? 12 : 0,
        windSpeed: 0,
        windDirection: 0,
    };
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-testid="hedgehog-shelter"
                        data-ready={ready}
                        data-runtime={report}
                        data-hit={hit}
                        data-plant-clicks={plantClicks}
                        style={{
                            width: small ? 390 : 680,
                            height: small ? 440 : 520,
                            position: 'relative',
                            transform: offscreen
                                ? 'translateY(200vh)'
                                : undefined,
                        }}
                    >
                        <Scene
                            position={
                                closeUp ? [100, 90, -100] : [-100, 100, -100]
                            }
                            zoom={closeUp ? 280 : small ? 57 : 90}
                            quality={quality}
                            pixelRatio={1}
                            fixedTimeSeconds={live ? undefined : reviewSeconds}
                            frameloop="demand"
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
                                            name={`review:${block.id}`}
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
                                <group
                                    name="review-crops"
                                    position={[0, 1.4, -0.95]}
                                >
                                    {[0, 4, 8].map((positionIndex) => (
                                        <RaisedBedPlantField
                                            key={positionIndex}
                                            blockIndex={0}
                                            orientation="vertical"
                                            field={{
                                                positionIndex,
                                                plantSortId: 337,
                                                plantStatus: 'ready',
                                                plantSowDate:
                                                    '2026-06-01T12:00:00Z',
                                            }}
                                        />
                                    ))}
                                </group>
                                {/* Use the production field-button component at a representative crop anchor.
                        The full close-up HUD is DOM above the scene and has separate app tests. */}
                                <Html position={[0, 0.95, -1.2]} center>
                                    <div style={{ width: 58, height: 44 }}>
                                        <RaisedBedFieldItemButton
                                            aria-label="Pregledaj rajčicu"
                                            positionIndex={0}
                                            onClick={() =>
                                                setPlantClicks(
                                                    (count) => count + 1,
                                                )
                                            }
                                        >
                                            Rajčica
                                        </RaisedBedFieldItemButton>
                                    </div>
                                </Html>
                                {visitors && (
                                    <Hedgehogs
                                        stacks={stacks}
                                        quality={quality}
                                        gardenId="hedgehog-review"
                                        weather={weather}
                                    />
                                )}
                                {runtime && (
                                    <HedgehogRuntimeProbe
                                        onReport={setReport}
                                    />
                                )}
                                <HedgehogShelterProbe
                                    onReady={setReady}
                                    weather={light}
                                    closeUp={closeUp}
                                />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
