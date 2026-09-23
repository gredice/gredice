import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { EntityInstances } from '../src/entities/EntityInstances';
import { FenceGate } from '../src/entities/FenceGate';
import { GardenBox } from '../src/entities/GardenBox';
import { QueuedPlacementDropAnimation } from '../src/entities/helpers/PlacementDropAnimation';
import { OutletDisplayTable } from '../src/entities/OutletDisplayTable';
import { Tree } from '../src/entities/Tree';
import { WoodenBench } from '../src/entities/WoodenBench';
import { ParticleSystemProvider } from '../src/particles/ParticleSystem';
import { AutumnLeaves } from '../src/scene/AutumnLeaves';
import type { GameQualityTier } from '../src/scene/gameQuality';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { animated, useSpring } from '../src/scene/sceneSpring';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { AutumnSceneProbe } from './AutumnSceneProbe';

function MovingAutumnBench({ targetX }: { targetX: number }) {
    const stack = useMemo(
        () => ({
            position: new Vector3(10, 0, 1.5),
            blocks: [{ name: 'WoodenBench', id: 'moving-bench', rotation: 0 }],
        }),
        [],
    );
    const [{ offsetX }, api] = useSpring(() => ({
        from: { offsetX: 0 },
        config: { tension: 120, friction: 24 },
    }));
    useEffect(() => {
        void api.start({ offsetX: targetX - 10 });
    }, [api, targetX]);
    return (
        <animated.group position-x={offsetX}>
            <WoodenBench stack={stack} block={stack.blocks[0]} rotation={0} />
        </animated.group>
    );
}

export function AutumnVisualFixture({
    stage = 'midAutumn',
    disabled = false,
    snow = 0,
    lighting = 'day',
    instanced = false,
    zoom = 95,
    leaves = false,
    gusts = false,
    wind = 3,
    rain = 0,
    tier = 'high',
    ground = false,
    entities = false,
    partEntities = false,
    partRotation = 0,
    animateSprings = false,
    standaloneBox = false,
    motionDrop = false,
    movingBenchTargetX,
    focus,
    cameraHeight = 4,
}: {
    stage?: keyof ReturnType<typeof getSeasonDebugDates>;
    disabled?: boolean;
    snow?: number;
    lighting?: 'day' | 'twilight' | 'cloudy';
    zoom?: number;
    leaves?: boolean;
    gusts?: boolean;
    wind?: number;
    rain?: number;
    tier?: GameQualityTier;
    instanced?: boolean;
    ground?: boolean;
    entities?: boolean;
    partEntities?: boolean;
    partRotation?: number;
    animateSprings?: boolean;
    standaloneBox?: boolean;
    motionDrop?: boolean;
    movingBenchTargetX?: number;
    focus?: readonly [number, number, number];
    cameraHeight?: number;
}) {
    const [ready, setReady] = useState('');
    const [sprigColors, setSprigColors] = useState('');
    const [leafCount, setLeafCount] = useState(0);
    const [gustCount, setGustCount] = useState(0);
    const [groundCount, setGroundCount] = useState(0);
    const [entityCount, setEntityCount] = useState(0);
    const [partCount, setPartCount] = useState(0);
    const [partMismatchFrames, setPartMismatchFrames] = useState(0);
    const [partMotionSamples, setPartMotionSamples] = useState(0);
    const [partMismatchDetail, setPartMismatchDetail] = useState('');
    const [dropMotionSamples, setDropMotionSamples] = useState(0);
    const boxStack = useMemo(
        () => ({
            position: new Vector3(0, 0, -1.5),
            blocks: [
                {
                    name: 'GardenBox',
                    id: 'standalone-box',
                    rotation: partRotation % 4,
                },
            ],
        }),
        [partRotation],
    );
    const stacks = useMemo(
        () => [
            ...[-1.4, 0, 1.4].map((x, index) => ({
                position: new Vector3(x, 0, 0),
                blocks: [
                    ...(ground
                        ? [
                              {
                                  name:
                                      index === 2
                                          ? 'Block_Grass_Angle'
                                          : 'Block_Grass',
                                  id: `ground:${index}`,
                                  rotation: index,
                              },
                          ]
                        : []),
                    {
                        name: 'Tree',
                        id: `autumn-fixture:${index}`,
                        rotation: 0,
                    },
                ],
            })),
            ...(entities
                ? [
                      'Stool',
                      'StoneMedium',
                      'GiftBox_BlueWhite',
                      'Raised_Bed',
                      'Fence',
                  ].map((name, index) => ({
                      position: new Vector3(
                          ((index % 3) - 1) * 1.4,
                          0,
                          1.3 + Math.floor(index / 3) * 1.4,
                      ),
                      blocks: [
                          { name, id: `surface:${index}`, rotation: index % 4 },
                      ],
                  }))
                : []),
            ...(partEntities
                ? [
                      'WoodenBench',
                      'OutletDisplayTable',
                      'GardenBox',
                      'StoneLarge',
                      'FenceGate',
                      'StoneFenceGate',
                      'PolishedStoneFenceGate',
                  ].map((name, index) => ({
                      position: new Vector3(
                          ((index % 3) - 1) * 2.2,
                          0,
                          1.8 + Math.floor(index / 3) * 1.5,
                      ),
                      blocks: [
                          {
                              name,
                              id: `part-surface:${index}`,
                              rotation: partRotation % 4,
                          },
                      ],
                  }))
                : []),
            ...(partEntities
                ? [-2.2, 0, 2.2].map((x, index) => ({
                      position: new Vector3(x, 0, 4.5),
                      blocks: [
                          {
                              name: 'Tree',
                              id: `part-tree:${index}`,
                              rotation: 0,
                          },
                      ],
                  }))
                : []),
        ],
        [ground, entities, partEntities, partRotation],
    );
    const client = useMemo(() => new QueryClient(), []);
    const store = useMemo(() => {
        const next = createGameState({
            appBaseUrl: '',
            isMock: true,
            freezeTime: getSeasonDebugDates()[stage],
        });
        next.setState({
            weatherVisualizationDisabled: disabled,
            snowCoverage: snow,
            rainSurfaceIntensity: rain,
        });
        return next;
    }, [stage, disabled, snow, rain]);
    useDisposeGameStateStore(store);
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <div
                    data-testid="autumn-scene"
                    data-canopies={ready}
                    data-sprigs={sprigColors}
                    data-leaves={leafCount}
                    data-gust-leaves={gustCount}
                    data-ground-leaves={groundCount}
                    data-entity-leaves={entityCount}
                    data-part-leaves={partCount}
                    data-part-mismatch-frames={partMismatchFrames}
                    data-part-motion-samples={partMotionSamples}
                    data-part-mismatch-detail={partMismatchDetail}
                    data-drop-motion-samples={dropMotionSamples}
                    style={{ width: 640, height: 420 }}
                >
                    {standaloneBox && (
                        <>
                            <button
                                type="button"
                                data-testid="open-autumn-box"
                                onClick={() =>
                                    store.setState({
                                        openGardenBoxBlockId: 'standalone-box',
                                    })
                                }
                            >
                                Open box
                            </button>
                            <button
                                type="button"
                                data-testid="close-autumn-box"
                                onClick={() =>
                                    store.setState({
                                        openGardenBoxBlockId: null,
                                    })
                                }
                            >
                                Close box
                            </button>
                        </>
                    )}
                    {motionDrop && (
                        <button
                            type="button"
                            data-testid="start-autumn-combined-motion"
                            onClick={() => {
                                store
                                    .getState()
                                    .queueBlockPlacementDropAnimation(
                                        'part-surface:0',
                                        { mutationConfirmed: true },
                                    );
                                store.setState({
                                    openGardenBoxBlockId: 'standalone-box',
                                });
                            }}
                        >
                            Start motion
                        </button>
                    )}
                    <Scene
                        position={[
                            4 + (focus?.[0] ?? 0),
                            cameraHeight + (focus?.[1] ?? 0),
                            6 + (focus?.[2] ?? 0),
                        ]}
                        zoom={zoom}
                        quality={gameQualityProfiles.low}
                        fixedTimeSeconds={gusts ? 10.7 : 12}
                        animateSprings={animateSprings}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <color attach="background" args={['#e7e2cc']} />
                        <ambientLight
                            intensity={lighting === 'twilight' ? 0.45 : 1.5}
                        />
                        <directionalLight
                            position={[4, 8, 3]}
                            intensity={
                                lighting === 'cloudy'
                                    ? 0.4
                                    : lighting === 'twilight'
                                      ? 0.6
                                      : 2
                            }
                            color={
                                lighting === 'twilight' ? '#efac78' : '#ffffff'
                            }
                        />
                        {leaves && (
                            <AutumnLeaves
                                tier={tier}
                                windSpeed={wind}
                                windDirection={90}
                                stacks={gusts ? stacks : undefined}
                                gardenId={7}
                                rain={rain}
                                snow={snow}
                                enabled={!disabled}
                            />
                        )}
                        <Suspense fallback={null}>
                            {instanced ? (
                                <>
                                    <EntityInstances
                                        stacks={stacks}
                                        quality={
                                            gameQualityProfiles[
                                                ground ||
                                                entities ||
                                                partEntities
                                                    ? tier
                                                    : 'low'
                                            ]
                                        }
                                        weather={{
                                            windSpeed: 0,
                                            windDirection: 0,
                                        }}
                                        renderGroundDecorations={false}
                                    />
                                    {partEntities &&
                                        stacks.map((stack) => {
                                            const block = stack.blocks.at(-1);
                                            if (!block) return null;
                                            const props = {
                                                stack,
                                                block,
                                                rotation: block.rotation,
                                            };
                                            if (block.name === 'WoodenBench')
                                                return motionDrop ? (
                                                    <ParticleSystemProvider
                                                        key={block.id}
                                                    >
                                                        <QueuedPlacementDropAnimation
                                                            block={block}
                                                            particlePosition={[
                                                                stack.position
                                                                    .x,
                                                                0,
                                                                stack.position
                                                                    .z,
                                                            ]}
                                                        >
                                                            <WoodenBench
                                                                {...props}
                                                            />
                                                        </QueuedPlacementDropAnimation>
                                                    </ParticleSystemProvider>
                                                ) : (
                                                    <WoodenBench
                                                        key={block.id}
                                                        {...props}
                                                    />
                                                );
                                            if (
                                                block.name ===
                                                'OutletDisplayTable'
                                            )
                                                return (
                                                    <OutletDisplayTable
                                                        key={block.id}
                                                        {...props}
                                                    />
                                                );
                                            if (
                                                block.name === 'FenceGate' ||
                                                block.name ===
                                                    'StoneFenceGate' ||
                                                block.name ===
                                                    'PolishedStoneFenceGate'
                                            )
                                                return (
                                                    <FenceGate
                                                        key={block.id}
                                                        {...props}
                                                    />
                                                );
                                            return null;
                                        })}
                                    {standaloneBox && (
                                        <GardenBox
                                            stack={boxStack}
                                            block={boxStack.blocks[0]}
                                            rotation={partRotation % 4}
                                        />
                                    )}
                                    {movingBenchTargetX !== undefined && (
                                        <MovingAutumnBench
                                            targetX={movingBenchTargetX}
                                        />
                                    )}
                                </>
                            ) : (
                                stacks.map((stack) => (
                                    <Tree
                                        key={stack.blocks[0].id}
                                        stack={stack}
                                        block={stack.blocks[0]}
                                        rotation={0}
                                    />
                                ))
                            )}
                            <AutumnSceneProbe
                                onReady={setReady}
                                onSprigColors={setSprigColors}
                                onLeafCount={setLeafCount}
                                onGustCount={setGustCount}
                                onGroundCount={setGroundCount}
                                onEntityCount={setEntityCount}
                                onPartCount={setPartCount}
                                onPartMismatchFrames={setPartMismatchFrames}
                                onPartMotionSamples={setPartMotionSamples}
                                onPartMismatchDetail={setPartMismatchDetail}
                                onDropMotionSamples={setDropMotionSamples}
                                focus={focus}
                            />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
