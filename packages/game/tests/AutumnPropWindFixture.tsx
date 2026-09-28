import { Html } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useEffect, useMemo, useState } from 'react';
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
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';

import { AutumnPropWindProbe } from './AutumnPropWindProbe';

export function AutumnPropWindFixture({
    rotation = 0,
    tier = 'high',
    date = '2026-10-22',
    seconds = 12,
    wind = 3,
    rain = 0,
    snow = 0,
    disabled = false,
    sway = true,
    live = false,
}: {
    rotation?: number;
    tier?: 'low' | 'high';
    date?: string;
    seconds?: number;
    wind?: number;
    rain?: number;
    snow?: number;
    disabled?: boolean;
    sway?: boolean;
    live?: boolean;
}) {
    const [present, setPresent] = useState(true);
    const [ready, setReady] = useState('');
    const [hit, setHit] = useState('');
    const [plantClicks, setPlantClicks] = useState(0);
    const stacks = useMemo(() => {
        const names = [
            'AutumnGrassTuft',
            'AutumnSeedHeads',
            'AutumnWreathPost',
            'AutumnGarland',
            'GardenScarecrow',
            'AutumnFenceGate',
            'Tree',
            'Tree',
        ];
        return Array.from({ length: 16 }, (_, index) => ({
            position: new Vector3(
                (index % 4) - 2,
                0,
                Math.floor(index / 4) - 2,
            ),
            blocks: [
                { name: 'Block_Grass', id: `ground:${index}`, rotation: 0 },
                ...(index < names.length
                    ? [{ name: names[index], id: `prop:${index}`, rotation }]
                    : []),
                ...(index === 10
                    ? [{ name: 'Raised_Bed', id: 'bed', rotation: 0 }]
                    : []),
            ],
        }));
    }, [rotation]);
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
                freezeTime: new Date(`${date}T12:00:00+02:00`),
                dayNightCycleDisabled: false,
            }),
        [date],
    );
    useDisposeGameStateStore(store);
    useEffect(
        () => store.setState({ weatherVisualizationDisabled: disabled }),
        [store, disabled],
    );
    const quality = {
        ...gameQualityProfiles[tier],
        shadowMapSize: tier === 'high' ? 512 : 0,
        dpr: 1,
    };
    const weather = {
        cloudy: rain > 0 ? 1 : 0,
        foggy: 0,
        rainy: rain,
        snowy: 0,
        snowAccumulation: snow * 30,
        windSpeed: wind,
        windDirection: 90,
    };
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-testid="prop-wind"
                        data-ready={ready}
                        data-hit={hit}
                        data-plant-clicks={plantClicks}
                        style={{
                            width: 680,
                            height: 520,
                            position: 'relative',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setPresent((value) => !value)}
                        >
                            Toggle props
                        </button>
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={90}
                            quality={quality}
                            pixelRatio={1}
                            fixedTimeSeconds={live ? undefined : seconds}
                            profileStats
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
                                    renderGroundDecorations={false}
                                    stacks={stacks}
                                    quality={quality}
                                    weather={weather}
                                />
                                {present &&
                                    stacks.flatMap((stack) =>
                                        stack.blocks
                                            .slice(1)
                                            .filter(
                                                (block) =>
                                                    block.name !== 'Tree',
                                            )
                                            .map((block) => (
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
                                                        rotation={
                                                            block.rotation
                                                        }
                                                        weatherDisabled={
                                                            !sway &&
                                                            block.name !==
                                                                'Raised_Bed'
                                                        }
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
                                <AutumnPropWindProbe
                                    onReady={setReady}
                                    present={present}
                                />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
