import { useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    type RefObject,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { BeachBall } from '../src/entities/BeachBall';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { useSceneRuntimeVisible } from '../src/scene/SceneTime';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';
import type { Stack } from '../src/types/Stack';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../src/useGameState';

function BeachBallReadback({
    actor,
    store,
    onSample,
    mounted,
}: {
    actor: RefObject<Group | null>;
    store: GameStateStore;
    onSample: (value: string) => void;
    mounted: boolean;
}) {
    const { scene, camera, size } = useThree();
    const visible = useSceneRuntimeVisible();
    const matrix = useMemo(() => new Matrix4(), []);
    const center = useMemo(() => new Vector3(), []);
    const previous = useRef<Vector3 | null>(null);
    const previousDirection = useRef(0);
    const counters = useRef({
        frames: 0,
        maxFrameDistance: 0,
        shadowFailures: 0,
        shadowChecks: 0,
        directionReversals: 0,
        travelled: 0,
        maxRoll: 0,
    });
    const sample = useRef<Record<string, unknown>>({});
    const publish = useCallback(() => {
        onSample(
            JSON.stringify({
                ...sample.current,
                mounted,
                ...counters.current,
                visible,
                presences: store.getState().faunaWorld.queryPresences({
                    species: 'BeachBall',
                }),
            }),
        );
    }, [mounted, onSample, store, visible]);
    useSceneAfterFrame(
        useCallback(() => {
            counters.current.frames += 1;
            const hover = actor.current?.getObjectByName(
                'Interaction:HoverOutlineTarget',
            );
            const base = hover?.children[0];
            const motion = base?.children[0];
            const rolling = motion?.children[0];
            const shadows = scene.getObjectByName('ActorGroundingShadows');
            if (base && motion instanceof Group && rolling instanceof Group) {
                const x = base.position.x + motion.position.x;
                const z = base.position.z + motion.position.z;
                if (previous.current) {
                    const distance = motion.position.distanceTo(
                        previous.current,
                    );
                    counters.current.travelled += distance;
                    counters.current.maxFrameDistance = Math.max(
                        counters.current.maxFrameDistance,
                        distance,
                    );
                    const direction = Math.sign(
                        motion.position.x - previous.current.x,
                    );
                    if (direction !== 0) {
                        if (
                            previousDirection.current !== 0 &&
                            direction !== previousDirection.current
                        )
                            counters.current.directionReversals += 1;
                        previousDirection.current = direction;
                    }
                }
                previous.current = motion.position.clone();
                counters.current.maxRoll = Math.max(
                    counters.current.maxRoll,
                    Math.abs(rolling.rotation.x),
                    Math.abs(rolling.rotation.z),
                );
                if (shadows instanceof InstancedMesh && shadows.count === 1) {
                    shadows.getMatrixAt(0, matrix);
                    counters.current.shadowChecks += 1;
                    if (
                        Math.abs(matrix.elements[12] - x) > 1e-6 ||
                        Math.abs(matrix.elements[14] - z) > 1e-6
                    )
                        counters.current.shadowFailures += 1;
                } else counters.current.shadowFailures += 1;
                center.set(x, base.position.y + motion.position.y + 0.16, z);
                center.project(camera);
                sample.current = {
                    ready: true,
                    position: motion.position.toArray(),
                    rotation: rolling.rotation.toArray(),
                    screen: {
                        x: ((center.x + 1) / 2) * size.width,
                        y: ((1 - center.y) / 2) * size.height,
                    },
                };
            } else {
                previous.current = null;
                sample.current = { ready: false };
            }
            sample.current.shadowCount =
                shadows instanceof InstancedMesh ? shadows.count : null;
            publish();
        }, [actor, camera, center, matrix, publish, scene, size]),
    );
    useEffect(publish, [publish]);
    return null;
}

export function BeachBallRuntimeFixture() {
    const element = useRef<HTMLDivElement>(null);
    const actor = useRef<Group>(null);
    const [mounted, setMounted] = useState(true);
    const client = useMemo(() => new QueryClient(), []);
    const store = useMemo(
        () =>
            createGameState({ appBaseUrl: '', isMock: true, freezeTime: null }),
        [],
    );
    useDisposeGameStateStore(store);
    const block = useMemo(
        () => ({ name: 'BeachBall', id: 'runtime-ball', rotation: 0 }),
        [],
    );
    const stacks = useMemo<Stack[]>(
        () =>
            Array.from({ length: 9 }, (_, index) => ({
                position: new Vector3(
                    (index % 3) - 1,
                    0,
                    Math.floor(index / 3) - 1,
                ),
                blocks: [
                    { name: 'Block_Grass', id: `ground-${index}`, rotation: 0 },
                    ...(index === 4 ? [block] : []),
                ],
            })),
        [block],
    );
    const report = useCallback((value: string) => {
        if (element.current) element.current.dataset.sample = value;
    }, []);
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <button
                    type="button"
                    onClick={() =>
                        store.getState().kickGardenAvatarBeachBall({
                            targetId: block.id,
                            direction: { x: 1, z: 0 },
                        })
                    }
                >
                    Avatar kick
                </button>
                <button type="button" onClick={() => setMounted(false)}>
                    Remove ball
                </button>
                <div
                    ref={element}
                    data-testid="beach-ball-scene"
                    data-sample="{}"
                    style={{ width: 480, height: 360 }}
                >
                    <Scene
                        position={[0, 5, 8]}
                        zoom={90}
                        baseFramesPerSecond={60}
                        quality={gameQualityProfiles.medium}
                        pixelRatio={1}
                        staticOpaqueCacheEnabled={false}
                        adaptiveHighEnabled={false}
                        profileStats
                    >
                        <color attach="background" args={['#d1dbe0']} />
                        <ambientLight intensity={2} />
                        <Suspense fallback={null}>
                            <group ref={actor}>
                                {mounted && (
                                    <BeachBall
                                        block={block}
                                        stack={stacks[4]}
                                        stacks={stacks}
                                        rotation={0}
                                    />
                                )}
                            </group>
                            <BeachBallReadback
                                actor={actor}
                                store={store}
                                onSample={report}
                                mounted={mounted}
                            />
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
