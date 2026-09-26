import { Html } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import {
    Suspense,
    useCallback,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react';
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
import {
    type AutumnShrubReviewCase,
    autumnShrubReviewCases,
} from './autumnShrubReviewCases';
import { SeasonalMapleProbe } from './SeasonalMapleProbe';

export function SeasonalMapleFixture({
    rotation,
    scenario = 'autumn',
    night = false,
    small = false,
    dense = false,
}: {
    rotation: number;
    scenario?: AutumnShrubReviewCase;
    night?: boolean;
    small?: boolean;
    dense?: boolean;
}) {
    const revision = `${scenario}:${rotation}:${night}:${small}:${dense}`;
    const [report, setReport] = useState({ revision: '', data: '' });
    const onReady = useCallback(
        (data: string) => setReport({ revision, data }),
        [revision],
    );
    const ready = report.revision === revision ? report.data : '';
    const date = useMemo(() => {
        const value = new Date(autumnShrubReviewCases[scenario].date);
        if (night) value.setHours(22, 30);
        return value;
    }, [scenario, night]);
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
                        ...(x === -2 && z === 1
                            ? [
                                  {
                                      name: 'OutletDisplayTable',
                                      id: 'table',
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(x === -2 && (z === -1 || z === 1)
                            ? [
                                  {
                                      name: 'SeasonalMaple',
                                      id:
                                          z === -1
                                              ? 'shrub-ground'
                                              : 'shrub-table',
                                      rotation,
                                  },
                              ]
                            : []),
                        ...(x === -1 && z === 1
                            ? [
                                  {
                                      name: 'SeasonalMaple',
                                      id: 'shrub-disabled',
                                      rotation,
                                  },
                              ]
                            : []),
                        ...(x === 1 && z === 1
                            ? [{ name: 'Bush', id: 'legacy-bush', rotation: 0 }]
                            : []),
                        ...(x === 0 && z === -1
                            ? [{ name: 'Raised_Bed', id: 'bed', rotation: 0 }]
                            : []),
                    ],
                };
            }),
        [rotation],
    );
    const sceneStacks = useMemo(
        () =>
            dense
                ? [
                      ...stacks,
                      ...Array.from({ length: 64 }, (_, i) => ({
                          position: new Vector3(
                              (i % 8) + 3,
                              0,
                              Math.floor(i / 8) - 4,
                          ),
                          blocks: [
                              {
                                  name: 'Block_Grass',
                                  id: `dense-ground:${i}`,
                                  rotation: 0,
                              },
                              {
                                  name: i % 2 ? 'Tree' : 'SeasonalMaple',
                                  id: `dense-tree:${i}`,
                                  rotation: i % 4,
                              },
                          ],
                      })),
                  ]
                : stacks,
        [stacks, dense],
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
            stacks: sceneStacks,
            raisedBeds: [],
        });
        queryClient.setQueryData(['sorts'], []);
        queryClient.setQueryData(['operations'], []);
        queryClient.setQueryData(['currentUser'], null);
        return queryClient;
    }, [sceneStacks]);
    const [store] = useState(() =>
        createGameState({
            appBaseUrl: '',
            isMock: true,
            authenticatedGardenQueriesEnabled: false,
            winterMode: 'summer',
            freezeTime: date,
            dayNightCycleDisabled: false,
        }),
    );
    useLayoutEffect(() => {
        store.getState().setFreezeTime(date);
        // Test-local state only; do not persist a browser preference between scenarios.
        store.setState({
            weatherVisualizationDisabled: scenario === 'disabled',
        });
    }, [date, scenario, store]);
    useDisposeGameStateStore(store);
    const quality = gameQualityProfiles[small ? 'low' : 'high'];
    const weather = {
        cloudy: scenario === 'rain' || scenario === 'snow' ? 0.8 : 0,
        foggy: 0,
        rainy: scenario === 'rain' ? 2 : 0,
        snowy: scenario === 'snow' ? 1 : 0,
        snowAccumulation:
            scenario === 'snow' || scenario === 'disabled' ? 20 : 0,
        windSpeed: 0,
        windDirection: 0,
    };
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-testid="seasonal-maple"
                        data-ready={ready}
                        data-case={scenario}
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
                                    stacks={sceneStacks}
                                    quality={quality}
                                    weather={weather}
                                />
                                {sceneStacks.flatMap((stack) =>
                                    stack.blocks
                                        .slice(1)
                                        .filter(
                                            (block) => block.name !== 'Tree',
                                        )
                                        .map((block) => (
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
                                                    weatherDisabled={
                                                        block.id ===
                                                        'shrub-disabled'
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
                                <SeasonalMapleProbe
                                    ready={Boolean(ready)}
                                    onReady={onReady}
                                    scenario={scenario}
                                    date={date}
                                />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
