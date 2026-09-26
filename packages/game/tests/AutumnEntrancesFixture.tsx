import { Html } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import { EntityInstances } from '../src/entities/EntityInstances';
import { RaisedBedPlantField } from '../src/entities/raisedBed/RaisedBedPlantField';
import { currentGardenKeys } from '../src/hooks/useCurrentGarden';
import { RaisedBedFieldItemButton } from '../src/hud/raisedBed/RaisedBedFieldItemButton';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { loadLocalSandboxGarden } from '../src/localSandboxGarden';
import { Environment } from '../src/scene/Environment';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { createDateForGameTimeOfDay } from '../src/utils/timeOfDay';
import { AutumnEntranceGateInstance } from './AutumnEntranceGateInstance';

import { AutumnEntrancesProbe } from './AutumnEntrancesProbe';

export function AutumnEntrancesFixture({
    rotation,
    light = 'day',
    small = false,
    date = '2026-09-23',
    raised = false,
    gateOpen = false,
}: {
    rotation: number;
    light?: 'day' | 'night' | 'dusk' | 'cloudy' | 'rain' | 'snow';
    small?: boolean;
    date?: string;
    raised?: boolean;
    gateOpen?: boolean;
}) {
    const storageKey = `autumn-entrances:${rotation}:${raised}:${gateOpen}`;
    const [ready, setReady] = useState('');
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
                        ...(raised && x === -2 && z >= -1 && z <= 1
                            ? [
                                  {
                                      name: 'OutletDisplayTable',
                                      id: `table:${index}`,
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(x === -2 && z >= -1 && z <= 1
                            ? [
                                  {
                                      name:
                                          z === -1
                                              ? 'AutumnWreathPost'
                                              : z === 0
                                                ? 'AutumnGarland'
                                                : 'AutumnFenceGate',
                                      id:
                                          z === -1
                                              ? 'wreath'
                                              : z === 0
                                                ? 'garland'
                                                : 'gate',
                                      rotation,
                                      variant: z === 1 && gateOpen ? 1 : 0,
                                  },
                              ]
                            : []),
                        ...(x === -1 && z === 1
                            ? [{ name: 'Fence', id: 'fence', rotation: 0 }]
                            : []),
                        ...(x === -1 && z === 0
                            ? [
                                  {
                                      name: 'StoneMedium',
                                      id: 'stone',
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(x === -1 && z === -1
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
        [rotation, raised, gateOpen],
    );
    const client = useMemo(() => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        queryClient.setQueryData(
            ['blocks', 'local'],
            getLocalSandboxBlockData(),
        );
        queryClient.setQueryData(
            currentGardenKeys('summer', 0, undefined, storageKey),
            loadLocalSandboxGarden(storageKey, { stacks }),
        );
        queryClient.setQueryData(['sorts'], []);
        queryClient.setQueryData(['operations'], []);
        queryClient.setQueryData(['currentUser'], null);
        return queryClient;
    }, [stacks, storageKey]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: false,
                localSandboxStorageKey: storageKey,
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
        [light, date, storageKey],
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
                        data-testid="autumn-entrances"
                        data-ready={ready}
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
                                            {block.id === 'gate' ? (
                                                <AutumnEntranceGateInstance
                                                    block={block}
                                                    stack={stack}
                                                    rotation={block.rotation}
                                                />
                                            ) : (
                                                <EntityFactory
                                                    name={block.name}
                                                    block={block}
                                                    stack={stack}
                                                    rotation={block.rotation}
                                                    noControl
                                                />
                                            )}
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
                                <AutumnEntrancesProbe
                                    onReady={setReady}
                                    weather={light}
                                    storageKey={storageKey}
                                />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
