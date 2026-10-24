import { Html } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Fragment, Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import { EntityInstances } from '../src/entities/EntityInstances';
import { RaisedBedPlantField } from '../src/entities/raisedBed/RaisedBedPlantField';
import { createMockGarden } from '../src/hooks/useCurrentGarden';
import { RaisedBedFieldItemButton } from '../src/hud/raisedBed/RaisedBedFieldItemButton';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { Environment } from '../src/scene/Environment';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { SteamSourcesProvider } from '../src/scene/SteamSources';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { createDateForGameTimeOfDay } from '../src/utils/timeOfDay';

import { GardenTeaTableProbe } from './GardenTeaTableProbe';
import { SteamProbe } from './SteamProbe';

export function GardenTeaTableFixture({
    rotation,
    light = 'day',
    small = false,
    raised = false,
    date = '2026-09-23',
    fixedTimeSeconds = 12,
    steamProbe = false,
    disabled = false,
    windSpeed = 0,
}: {
    rotation: number;
    light?: 'day' | 'night' | 'dusk' | 'cloudy' | 'rain' | 'snow';
    small?: boolean;
    raised?: boolean;
    date?: string;
    fixedTimeSeconds?: number;
    steamProbe?: boolean;
    disabled?: boolean;
    windSpeed?: number;
}) {
    const [steam, setSteam] = useState('');
    const [ready, setReady] = useState('');
    const [hit, setHit] = useState('');
    const [plantClicks, setPlantClicks] = useState(0);
    // Keep the existing static asset release captures independent of ambient effects.
    const SteamScope = steamProbe ? Fragment : SteamSourcesProvider;
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
                        ...(x === -2 && z === -1
                            ? [
                                  {
                                      name: 'GardenTeaTable',
                                      id: 'tea-table',
                                      rotation,
                                  },
                              ]
                            : []),
                        ...(x === -1 && z === 1
                            ? [{ name: 'Tree', id: 'tree', rotation: 0 }]
                            : []),
                        ...(x === -1 && z === (raised ? -1 : 0)
                            ? [
                                  {
                                      name: 'WoodlandMushrooms',
                                      id: 'mushrooms',
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
        [rotation, raised],
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
                freezeTime:
                    light === 'dusk'
                        ? createDateForGameTimeOfDay(
                              new Date(`${date}T12:00:00+02:00`),
                              0.8,
                          )
                        : new Date(
                              light === 'night'
                                  ? `${date}T22:30:00+02:00`
                                  : `${date}T12:00:00+02:00`,
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
        windSpeed,
        windDirection: 0,
    };
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-testid="garden-tea-table"
                        data-ready={ready}
                        data-steam={steam}
                        data-hit={hit}
                        data-plant-clicks={plantClicks}
                        style={{
                            width: small ? 390 : 680,
                            height: small ? 440 : 520,
                            position: 'relative',
                        }}
                    >
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={small ? 57 : 90}
                            quality={quality}
                            pixelRatio={1}
                            fixedTimeSeconds={fixedTimeSeconds}
                            frameloop="always"
                            animateSprings={false}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <Environment
                                quality={quality}
                                weather={weather}
                                noSound
                                noWeather={disabled}
                            />
                            {steamProbe && <SteamProbe onSample={setSteam} />}
                            <SteamScope>
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
                                    <GardenTeaTableProbe
                                        onReady={setReady}
                                        weather={light}
                                    />
                                </Suspense>
                            </SteamScope>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
