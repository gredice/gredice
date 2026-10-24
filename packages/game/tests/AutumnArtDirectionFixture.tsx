import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EnamelGardenLamp } from '../src/entities/EnamelGardenLamp';
import { EntityInstances } from '../src/entities/EntityInstances';
import { OutletDisplayTable } from '../src/entities/OutletDisplayTable';
import { WoodenBench } from '../src/entities/WoodenBench';
import { Environment } from '../src/scene/Environment';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { createDateForGameTimeOfDay } from '../src/utils/timeOfDay';
import { AutumnSceneProbe } from './AutumnSceneProbe';

// Existing shipped assets only. Future collection props are specified in the brief.
const props = [
    { name: 'Tree', x: 2, z: 2 },
    { name: 'Tree', x: 0, z: 2 },
    { name: 'Tree', x: 2, z: 1 },
    { name: 'Pine', x: -2, z: 2 },
    { name: 'WoodenBench', x: -2, z: 0 },
    { name: 'OutletDisplayTable', x: -1, z: 0 },
    { name: 'BaleHey', x: 2, z: 0 },
    { name: 'Bucket', x: 1, z: 0 },
    { name: 'PotLowBowl', x: 2, z: -1 },
    { name: 'StoneMedium', x: -2, z: -2 },
];

const stacks = Array.from({ length: 36 }, (_, index) => {
    const x = (index % 6) - 3;
    const z = Math.floor(index / 6) - 3;
    const prop = props.find((item) => item.x === x && item.z === z);
    return {
        position: new Vector3(x, 0, z),
        blocks: [
            { name: 'Block_Grass', id: `art:ground:${index}`, rotation: 0 },
            ...(prop
                ? [
                      {
                          name: prop.name,
                          id: `art:${prop.name}:${index}`,
                          rotation: 0,
                      },
                  ]
                : []),
        ],
    };
});
const lampStack = stacks.find(
    (stack) => stack.position.x === -2 && stack.position.z === -1,
);
const lampBlock = { name: 'EnamelGardenLamp', id: 'art:lamp', rotation: 0 };
if (lampStack) lampStack.blocks.push(lampBlock);

export function AutumnArtDirectionFixture({
    month,
    day,
    light,
    tier = 'high',
    width = 960,
    height = 680,
}: {
    month: number;
    day: number;
    light: 'sun' | 'overcast' | 'dusk' | 'night';
    tier?: 'low' | 'high';
    width?: number;
    height?: number;
}) {
    const [ready, setReady] = useState('');
    const client = useMemo(() => new QueryClient(), []);
    const date = useMemo(() => {
        const noon = new Date(2026, month - 1, day, 12);
        if (light === 'dusk') return createDateForGameTimeOfDay(noon, 0.8);
        if (light === 'night') noon.setHours(22, 30);
        return noon;
    }, [month, day, light]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                mockGardenProfile: 'high-target',
                authenticatedGardenQueriesEnabled: false,
                freezeTime: date,
                dayNightCycleDisabled: false,
            }),
        [date],
    );
    useDisposeGameStateStore(store);
    const quality = gameQualityProfiles[tier];
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
                        data-testid="art-scene"
                        data-ready={ready}
                        data-date={date.toISOString()}
                        data-autumn={JSON.stringify(
                            store.getState().autumnState,
                        )}
                        style={{ width, height }}
                    >
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={width < 500 ? 42 : 76}
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
                                <EntityInstances
                                    stacks={stacks}
                                    quality={quality}
                                    weather={weather}
                                    renderGroundDecorations
                                />
                                {stacks.flatMap((stack) =>
                                    stack.blocks.map((block) => {
                                        if (block.name === 'WoodenBench')
                                            return (
                                                <WoodenBench
                                                    key={block.id}
                                                    stack={stack}
                                                    block={block}
                                                    rotation={0}
                                                />
                                            );
                                        if (block.name === 'OutletDisplayTable')
                                            return (
                                                <OutletDisplayTable
                                                    key={block.id}
                                                    stack={stack}
                                                    block={block}
                                                    rotation={0}
                                                />
                                            );
                                        return null;
                                    }),
                                )}
                                {lampStack && (
                                    <EnamelGardenLamp
                                        stack={lampStack}
                                        block={lampBlock}
                                        rotation={0}
                                    />
                                )}
                                <AutumnSceneProbe
                                    onReady={setReady}
                                    focus={[-0.5, 0.4, -0.5]}
                                />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
