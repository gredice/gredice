import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import { EntityInstances } from '../src/entities/EntityInstances';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { AutumnLeaves } from '../src/scene/AutumnLeaves';
import {
    type GameQualityTier,
    gameQualityProfiles,
} from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { WarmProps } from '../src/warmProps/WarmProps';
import { WarmPropsProbe } from './WarmPropsProbe';

export function WarmPropsFixture({
    tier = 'high',
    mounted = true,
    enabled = true,
    sound = false,
    rain = 0,
    snow = 0,
    live = false,
    fixedTime = 12,
    rotation = 0,
    offset = 0,
    date = 'lateAutumn',
}: {
    tier?: GameQualityTier;
    mounted?: boolean;
    enabled?: boolean;
    sound?: boolean;
    rain?: number;
    snow?: number;
    live?: boolean;
    fixedTime?: number;
    rotation?: number;
    offset?: number;
    date?: 'summer' | 'lateAutumn' | 'winter';
}) {
    const sample = useRef<HTMLDivElement>(null);
    const report = useCallback((value: string) => {
        if (sample.current) sample.current.dataset.sample = value;
    }, []);
    const [selected, setSelected] = useState('');
    const [store] = useState(() =>
        createGameState({
            appBaseUrl: '',
            isMock: true,
            authenticatedGardenQueriesEnabled: false,
            freezeTime: getSeasonDebugDates().lateAutumn,
        }),
    );
    useDisposeGameStateStore(store);
    useEffect(() => {
        store.getState().setSceneDate(getSeasonDebugDates()[date]);
        store.setState({ snowCoverage: snow, rainSurfaceIntensity: rain });
    }, [store, date, snow, rain]);
    const client = useMemo(() => {
        const result = new QueryClient();
        result.setQueryData(['blocks', 'local'], getLocalSandboxBlockData());
        return result;
    }, []);
    const stacks = useMemo(
        () =>
            Array.from({ length: 49 }, (_, index) => ({
                position: new Vector3(
                    (index % 7) - 3,
                    0,
                    Math.floor(index / 7) - 3,
                ),
                blocks: [
                    { name: 'Block_Grass', id: `ground:${index}`, rotation: 0 },
                    ...(index === 1
                        ? [{ name: 'Stool', id: 'leaf-stool', rotation: 0 }]
                        : []),
                    ...(index === 0 || index === 6 || index === 42
                        ? [{ name: 'Tree', id: `tree:${index}`, rotation: 0 }]
                        : []),
                ],
            })),
        [],
    );
    const props = useMemo(
        () =>
            Array.from({ length: 10 }, (_, index) => {
                const block = {
                    name: index > 7 ? 'ChestnutRoastingCart' : 'GardenBrazier',
                    id: `warm:${index}`,
                    rotation,
                };
                return {
                    block,
                    stack: {
                        position: new Vector3(
                            (index % 4) * 1.6 - 2.4 + offset,
                            0,
                            Math.floor(index / 4) * 1.5 - 1.5,
                        ),
                        blocks: [
                            {
                                name: 'Block_Grass',
                                id: `support:${index}`,
                                rotation: 0,
                            },
                            ...(index === 0
                                ? [
                                      {
                                          name: 'OutletDisplayTable',
                                          id: 'warm-table',
                                          rotation: 0,
                                      },
                                  ]
                                : []),
                            block,
                        ],
                    },
                };
            }),
        [rotation, offset],
    );
    const audio = store.getState().audio;
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <button
                    type="button"
                    onClick={() => audio.resume({ userActivation: true })}
                >
                    Enable audio
                </button>
                <button
                    type="button"
                    onClick={() =>
                        audio.setMasterMuted(!audio.getState().master.isMuted)
                    }
                >
                    Toggle master
                </button>
                <button
                    type="button"
                    onClick={() =>
                        audio.setChannelMuted(
                            'ambient',
                            !audio.getState().ambient.isMuted,
                        )
                    }
                >
                    Toggle ambient
                </button>
                <button
                    type="button"
                    onClick={() =>
                        audio.setChannelVolume(
                            'ambient',
                            audio.getState().ambient.volume ? 0 : 0.5,
                        )
                    }
                >
                    Toggle volume
                </button>
                <div
                    ref={sample}
                    data-testid="warm-props"
                    data-sample="{}"
                    data-selected={selected}
                    style={{ width: 680, height: 520 }}
                >
                    <Scene
                        position={[10, 12, 15]}
                        zoom={57}
                        quality={gameQualityProfiles.low}
                        fixedTimeSeconds={live ? undefined : fixedTime}
                        animateSprings={false}
                        profileStats
                    >
                        <color attach="background" args={['#becbd3']} />
                        <ambientLight intensity={1.2} />
                        <directionalLight
                            position={[4, 8, 2]}
                            intensity={1.5}
                        />
                        <Suspense fallback={null}>
                            <EntityInstances
                                stacks={stacks}
                                quality={gameQualityProfiles[tier]}
                                weather={{ windSpeed: 1, windDirection: 90 }}
                            />
                            <AutumnLeaves
                                stacks={stacks}
                                tier={tier}
                                gardenId={7}
                                windSpeed={1}
                                enabled
                            />
                            {props.map(({ block, stack }) => (
                                // biome-ignore lint/a11y/noStaticElementInteractions: Three.js selection target.
                                <group
                                    key={block.id}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setSelected(block.id);
                                    }}
                                >
                                    {stack.blocks
                                        .filter(
                                            (item) =>
                                                item.name ===
                                                'OutletDisplayTable',
                                        )
                                        .map((support) => (
                                            <EntityFactory
                                                key={support.id}
                                                name={support.name}
                                                block={support}
                                                stack={stack}
                                                rotation={0}
                                                noControl
                                            />
                                        ))}
                                    <EntityFactory
                                        name={block.name}
                                        block={block}
                                        stack={stack}
                                        rotation={rotation}
                                        noControl
                                    />
                                </group>
                            ))}
                            {mounted && (
                                <WarmProps
                                    tier={tier}
                                    enabled={enabled}
                                    soundEnabled={sound}
                                    rain={rain}
                                    snow={snow}
                                    windSpeed={1}
                                    windDirection={90}
                                />
                            )}
                            <WarmPropsProbe onSample={report} />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
