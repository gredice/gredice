import { useAnimations } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { Group } from 'three';
import { MathUtils, type Mesh, Vector3 } from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
    type GameState,
    useGameState,
} from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { AnimalTargetDebugMarker } from '../animals/AnimalDebugIndicators';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import {
    type BatLifecyclePhase,
    type BatWeather,
    createBatRandom,
    globalBatPopulationRegistry,
    hashBatSeed,
    isBatActive,
    planBatPopulation,
    resolveBatLifecyclePhase,
    shouldBatGlide,
} from './batBehavior';
import {
    type BatAvoidSphere,
    type BatFlightWaypoint,
    type BatHabitat,
    chooseBatWaypoint,
    createBatAvoidanceWaypoint,
    createBatHabitats,
    isBatSegmentClear,
} from './batFlight';

type BatWeatherOverride = Partial<NonNullable<GameState['weather']>>;
type BatAnimation = 'flap' | 'glide' | 'roost';
type BatBehavior =
    | 'emerge'
    | 'circle'
    | 'forage'
    | 'glide'
    | 'avoid-avatar'
    | 'avoid-camera'
    | 'return'
    | 'roost';

type BatRuntime = {
    animation: BatAnimation;
    arcHeight: number;
    bankSign: -1 | 1;
    behavior: BatBehavior;
    completedSegments: number;
    duration: number;
    from: Vector3;
    phase: BatLifecyclePhase;
    startedAt: number;
    to: Vector3;
    waypointIndex: number;
};

const clearBatWeather: Required<BatWeather> = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
};
const batScale = 0.25;
const batFlightSpeed = 1.55;
const batGlideSpeed = 1.82;
const batEmergenceSpeed = 1.32;
const batReturnSpeed = 1.72;
const batMinimumSegmentSeconds = 0.75;
const batMaximumSegmentSeconds = 4.6;
const batAvoidanceIntervalSeconds = 0.18;
const batCameraAvoidRadius = 1.45;
const batAvatarAvoidRadius = 0.95;
const batAnimationFadeSeconds = 0.24;
const batDebugUpdateIntervalSeconds = 0.5;

function resolveBatWeather({
    gameWeather,
    weatherDisabled,
    weatherNow,
    weatherOverride,
}: {
    gameWeather: GameState['weather'];
    weatherDisabled: boolean;
    weatherNow: BatWeather | null | undefined;
    weatherOverride: BatWeatherOverride | undefined;
}) {
    if (weatherDisabled) {
        return clearBatWeather;
    }
    if (weatherOverride) {
        return { ...clearBatWeather, ...weatherOverride };
    }
    if (!weatherNow && !gameWeather) {
        return undefined;
    }
    return { ...clearBatWeather, ...weatherNow, ...gameWeather };
}

function motionDuration(
    from: Vector3,
    to: Vector3,
    phase: BatLifecyclePhase,
    animation: BatAnimation,
) {
    const speed =
        phase === 'emerging'
            ? batEmergenceSpeed
            : phase === 'returning'
              ? batReturnSpeed
              : animation === 'glide'
                ? batGlideSpeed
                : batFlightSpeed;
    return MathUtils.clamp(
        from.distanceTo(to) / speed,
        batMinimumSegmentSeconds,
        batMaximumSegmentSeconds,
    );
}

function createRuntime({
    animation,
    behavior,
    completedSegments,
    from,
    now,
    phase,
    random,
    to,
    waypointIndex,
}: {
    animation: BatAnimation;
    behavior: BatBehavior;
    completedSegments: number;
    from: Vector3;
    now: number;
    phase: BatLifecyclePhase;
    random: () => number;
    to: Vector3;
    waypointIndex: number;
}): BatRuntime {
    return {
        animation,
        arcHeight:
            phase === 'returning'
                ? 0.24
                : animation === 'glide'
                  ? 0.08
                  : 0.16 + random() * 0.22,
        bankSign: random() < 0.5 ? -1 : 1,
        behavior,
        completedSegments,
        duration: motionDuration(from, to, phase, animation),
        from,
        phase,
        startedAt: now,
        to,
        waypointIndex,
    };
}

function waypointBehavior(
    waypoint: BatFlightWaypoint,
    animation: BatAnimation,
): BatBehavior {
    if (animation === 'glide') {
        return 'glide';
    }
    return waypoint.kind;
}

function createBatDebugEntry({
    group,
    habitat,
    id,
    now,
    runtime,
}: {
    group: Group;
    habitat: BatHabitat;
    id: string;
    now: number;
    runtime: BatRuntime;
}): AnimalDebugEntry {
    return {
        activity:
            runtime.animation === 'glide'
                ? 'Gliding between foraging turns'
                : runtime.phase === 'returning'
                  ? 'Returning to hidden cover'
                  : 'Night insect forage',
        behavior: runtime.behavior,
        debugBehaviors: ['circle', 'forage', 'glide', 'return'],
        id,
        label: habitat.id.replace('environment-bat:', ''),
        phase: runtime.phase,
        position: {
            x: Math.round(group.position.x * 100) / 100,
            y: Math.round(group.position.y * 100) / 100,
            z: Math.round(group.position.z * 100) / 100,
        },
        species: 'Bat',
        targetId: `${habitat.id}:air:${runtime.waypointIndex}`,
        updatedAt: now,
    };
}

function Bat({
    active,
    habitat,
    id,
    index,
    onHidden,
}: {
    active: boolean;
    habitat: BatHabitat;
    id: string;
    index: number;
    onHidden: (id: string) => void;
}) {
    const gltf = useGameGLTF('Bat');
    const groupRef = useRef<Group>(null);
    const targetDebugRef = useRef<Group>(null);
    const seed = hashBatSeed(habitat.seed, index);
    const randomRef = useRef(createBatRandom(seed));
    const runtimeRef = useRef<BatRuntime | null>(null);
    const hiddenReportedRef = useRef(false);
    const animationRef = useRef<BatAnimation>('roost');
    const [animation, setAnimation] = useState<BatAnimation>('roost');
    const nextPositionRef = useRef(new Vector3());
    const directionRef = useRef(new Vector3());
    const lastAvoidanceAtRef = useRef(0);
    const lastDebugUpdateAtRef = useRef(0);
    const avatarPresence = useGameState((state) => state.gardenAvatarPresence);
    const animalTargetsDebugVisible = useGameState(
        (state) => state.animalTargetsDebugVisible,
    );
    const setAnimalDebugEntry = useGameState(
        (state) => state.setAnimalDebugEntry,
    );
    const removeAnimalDebugEntry = useGameState(
        (state) => state.removeAnimalDebugEntry,
    );
    const cameraSphereRef = useRef<BatAvoidSphere>({
        center: { x: 0, y: 0, z: 0 },
        radius: batCameraAvoidRadius,
    });
    const avatarSphereRef = useRef<BatAvoidSphere>({
        center: { x: 0, y: 0, z: 0 },
        radius: batAvatarAvoidRadius,
    });
    const cameraAvoidRef = useRef<readonly BatAvoidSphere[]>([
        cameraSphereRef.current,
    ]);
    const avatarAvoidRef = useRef<readonly BatAvoidSphere[]>([
        avatarSphereRef.current,
    ]);
    const combinedAvoidRef = useRef<readonly BatAvoidSphere[]>([
        cameraSphereRef.current,
        avatarSphereRef.current,
    ]);
    const batModel = useMemo(() => {
        const scene = gltf.scene.clone(true);
        configureActorMeshShadows(scene, (mesh: Mesh) => {
            mesh.receiveShadow = true;
        });
        return scene;
    }, [gltf.scene]);
    const { actions } = useAnimations(gltf.animations, batModel);
    const clock = useThree((state) => state.clock);

    const setBatAnimation = (next: BatAnimation) => {
        if (animationRef.current === next) {
            return;
        }
        animationRef.current = next;
        setAnimation(next);
    };

    useEffect(() => {
        const flap = actions.Bat_Flap;
        const glide = actions.Bat_Glide;
        const roost = actions.Bat_Roost;
        flap?.fadeOut(batAnimationFadeSeconds);
        glide?.fadeOut(batAnimationFadeSeconds);
        roost?.fadeOut(batAnimationFadeSeconds);
        const selected =
            animation === 'flap' ? flap : animation === 'glide' ? glide : roost;
        if (selected) {
            selected.timeScale =
                animation === 'flap' ? 1.45 + (seed % 7) * 0.055 : 1;
            selected.reset();
            selected.time = animation === 'flap' ? ((seed % 25) / 25) * 0.9 : 0;
            selected.fadeIn(batAnimationFadeSeconds).play();
        }
    }, [actions, animation, seed]);

    useEffect(() => {
        return () => removeAnimalDebugEntry(id);
    }, [id, removeAnimalDebugEntry]);

    useEffect(() => {
        if (!active) {
            return;
        }
        hiddenReportedRef.current = false;
    }, [active]);

    function reportHidden() {
        if (hiddenReportedRef.current) {
            return;
        }
        hiddenReportedRef.current = true;
        onHidden(id);
    }

    function beginReturn(group: Group, now: number, runtime: BatRuntime) {
        const from = group.position.clone();
        if (
            !isBatSegmentClear({
                from,
                to: habitat.roost,
                world: habitat.world,
            })
        ) {
            group.visible = false;
            group.position.copy(habitat.roost);
            runtimeRef.current = {
                ...runtime,
                animation: 'roost',
                behavior: 'roost',
                from: habitat.roost.clone(),
                phase: 'hidden',
                to: habitat.roost.clone(),
            };
            setBatAnimation('roost');
            reportHidden();
            return;
        }
        runtimeRef.current = createRuntime({
            animation: 'flap',
            behavior: 'return',
            completedSegments: runtime.completedSegments,
            from,
            now,
            phase: 'returning',
            random: randomRef.current,
            to: habitat.roost.clone(),
            waypointIndex: runtime.waypointIndex,
        });
        setBatAnimation('flap');
    }

    function beginNextForagingSegment(
        group: Group,
        now: number,
        runtime: BatRuntime,
        avoid: readonly BatAvoidSphere[],
    ) {
        const random = randomRef.current;
        const target = chooseBatWaypoint({
            avoid,
            current: group.position,
            habitat,
            random,
            startIndex: runtime.waypointIndex + 1 + index,
        });
        if (!target) {
            beginReturn(group, now, runtime);
            return;
        }
        const completedSegments = runtime.completedSegments + 1;
        const nextAnimation = shouldBatGlide(random, completedSegments)
            ? 'glide'
            : 'flap';
        runtimeRef.current = createRuntime({
            animation: nextAnimation,
            behavior: waypointBehavior(target.waypoint, nextAnimation),
            completedSegments,
            from: group.position.clone(),
            now,
            phase: 'foraging',
            random,
            to: target.waypoint.position.clone(),
            waypointIndex: target.index,
        });
        setBatAnimation(nextAnimation);
    }

    useFrame(({ camera }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }
        const now = clock.elapsedTime;
        let runtime = runtimeRef.current;
        const cameraSphere = cameraSphereRef.current;
        cameraSphere.center.x = camera.position.x;
        cameraSphere.center.y = camera.position.y;
        cameraSphere.center.z = camera.position.z;
        const avatarSphere = avatarSphereRef.current;
        const hasAvatar = Boolean(avatarPresence);
        if (avatarPresence) {
            avatarSphere.center.x = avatarPresence.position.x;
            avatarSphere.center.y = avatarPresence.position.y + 0.55;
            avatarSphere.center.z = avatarPresence.position.z;
        }
        const avoid = hasAvatar
            ? combinedAvoidRef.current
            : cameraAvoidRef.current;

        if (!runtime) {
            group.position.copy(habitat.roost);
            group.visible = false;
            runtime = {
                animation: 'roost',
                arcHeight: 0,
                bankSign: 1,
                behavior: 'roost',
                completedSegments: 0,
                duration: 1,
                from: habitat.roost.clone(),
                phase: 'hidden',
                startedAt: now,
                to: habitat.roost.clone(),
                waypointIndex: index % habitat.waypoints.length,
            };
            runtimeRef.current = runtime;
            setBatAnimation('roost');
        }

        const resolvedPhase = resolveBatLifecyclePhase({
            active,
            phase: runtime.phase,
            reachedTarget: false,
        });
        if (resolvedPhase === 'returning' && runtime.phase !== 'returning') {
            beginReturn(group, now, runtime);
            runtime = runtimeRef.current;
            if (!runtime || runtime.phase === 'hidden') {
                return;
            }
        } else if (
            resolvedPhase === 'emerging' &&
            (runtime.phase === 'hidden' || runtime.phase === 'returning')
        ) {
            const target = chooseBatWaypoint({
                avoid,
                current: habitat.roost,
                habitat,
                random: randomRef.current,
                startIndex: index * 3,
            });
            if (!target) {
                group.visible = false;
                reportHidden();
                return;
            }
            group.position.copy(habitat.roost);
            runtime = createRuntime({
                animation: 'flap',
                behavior: 'emerge',
                completedSegments: 0,
                from: habitat.roost.clone(),
                now,
                phase: 'emerging',
                random: randomRef.current,
                to: target.waypoint.position.clone(),
                waypointIndex: target.index,
            });
            runtimeRef.current = runtime;
            setBatAnimation('flap');
        }

        if (
            runtime.phase !== 'hidden' &&
            now - lastAvoidanceAtRef.current >= batAvoidanceIntervalSeconds
        ) {
            lastAvoidanceAtRef.current = now;
            if (
                !isBatSegmentClear({
                    avoid,
                    from: group.position,
                    to: runtime.to,
                    world: habitat.world,
                })
            ) {
                const avatarThreat =
                    hasAvatar &&
                    !isBatSegmentClear({
                        avoid: avatarAvoidRef.current,
                        from: group.position,
                        to: runtime.to,
                        world: habitat.world,
                    })
                        ? createBatAvoidanceWaypoint({
                              current: group.position,
                              habitat,
                              seed: seed + runtime.completedSegments,
                              threat: avatarSphere,
                          })
                        : null;
                const cameraThreat =
                    !avatarThreat &&
                    !isBatSegmentClear({
                        avoid: cameraAvoidRef.current,
                        from: group.position,
                        to: runtime.to,
                        world: habitat.world,
                    })
                        ? createBatAvoidanceWaypoint({
                              current: group.position,
                              habitat,
                              seed: seed + runtime.completedSegments + 1,
                              threat: cameraSphere,
                          })
                        : null;
                const avoidanceTarget = avatarThreat ?? cameraThreat;
                if (avoidanceTarget) {
                    const avoidancePhase = active ? 'foraging' : 'returning';
                    runtime = createRuntime({
                        animation: 'flap',
                        behavior: avatarThreat
                            ? 'avoid-avatar'
                            : 'avoid-camera',
                        completedSegments: runtime.completedSegments,
                        from: group.position.clone(),
                        now,
                        phase: avoidancePhase,
                        random: randomRef.current,
                        to: avoidanceTarget,
                        waypointIndex: runtime.waypointIndex,
                    });
                    runtimeRef.current = runtime;
                    setBatAnimation('flap');
                }
            }
        }

        const progress = MathUtils.clamp(
            (now - runtime.startedAt) / runtime.duration,
            0,
            1,
        );
        const smoothProgress = progress * progress * (3 - 2 * progress);
        const nextPosition = nextPositionRef.current.lerpVectors(
            runtime.from,
            runtime.to,
            smoothProgress,
        );
        nextPosition.y += Math.sin(progress * Math.PI) * runtime.arcHeight;
        directionRef.current.subVectors(runtime.to, group.position);
        const horizontalDistance = Math.hypot(
            directionRef.current.x,
            directionRef.current.z,
        );
        const targetYaw = Math.atan2(
            directionRef.current.x,
            directionRef.current.z,
        );
        const targetPitch = MathUtils.clamp(
            -Math.atan2(directionRef.current.y, horizontalDistance),
            -0.32,
            0.32,
        );
        const targetBank =
            runtime.bankSign *
            (runtime.behavior === 'circle'
                ? 0.42
                : runtime.behavior.startsWith('avoid')
                  ? 0.34
                  : runtime.animation === 'glide'
                    ? 0.22
                    : 0.14);
        group.position.copy(nextPosition);
        group.rotation.y = MathUtils.damp(
            group.rotation.y,
            targetYaw,
            5.2,
            delta,
        );
        group.rotation.x = MathUtils.damp(
            group.rotation.x,
            targetPitch,
            4.8,
            delta,
        );
        group.rotation.z = MathUtils.damp(
            group.rotation.z,
            targetBank,
            4.4,
            delta,
        );
        if (runtime.phase === 'emerging' && progress >= 0.12) {
            group.visible = true;
        }
        if (runtime.phase === 'returning' && progress >= 0.86) {
            group.visible = false;
        }
        if (targetDebugRef.current) {
            targetDebugRef.current.visible = animalTargetsDebugVisible;
            targetDebugRef.current.position.copy(runtime.to);
        }

        if (
            now - lastDebugUpdateAtRef.current >=
            batDebugUpdateIntervalSeconds
        ) {
            lastDebugUpdateAtRef.current = now;
            setAnimalDebugEntry(
                createBatDebugEntry({ group, habitat, id, now, runtime }),
            );
        }

        if (progress < 1) {
            return;
        }
        group.position.copy(runtime.to);
        const completedPhase = resolveBatLifecyclePhase({
            active,
            phase: runtime.phase,
            reachedTarget: true,
        });
        if (completedPhase === 'hidden') {
            group.visible = false;
            runtimeRef.current = {
                ...runtime,
                animation: 'roost',
                behavior: 'roost',
                from: habitat.roost.clone(),
                phase: 'hidden',
                to: habitat.roost.clone(),
            };
            setBatAnimation('roost');
            reportHidden();
            return;
        }
        if (!active) {
            beginReturn(group, now, runtime);
            return;
        }
        beginNextForagingSegment(group, now, runtime, avoid);
    });

    return (
        <>
            <group ref={groupRef} scale={batScale}>
                <primitive object={batModel} />
            </group>
            <AnimalTargetDebugMarker ref={targetDebugRef} color="#c084fc" />
        </>
    );
}

export function Bats({
    farmId,
    gardenId,
    stacks,
    weather,
    weatherDisabled = false,
}: {
    farmId?: number | null;
    gardenId?: number | string | null;
    stacks: Stack[] | undefined;
    weather?: BatWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const ownerId = useId();
    const { data: blockData } = useBlockData();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const sunsetTime = useGameState((state) => state.sunsetTime);
    const gameWeather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow(
        !weatherDisabled && !weather,
        farmId,
    );
    const batWeather = resolveBatWeather({
        gameWeather,
        weatherDisabled,
        weatherNow,
        weatherOverride: weather,
    });
    const active = isBatActive(timeOfDay, batWeather);
    const seedKey = `${gardenId ?? farmId ?? 'sandbox'}:${
        sunsetTime?.toISOString().slice(0, 10) ?? 'undated'
    }`;
    const habitats = useMemo(
        () => createBatHabitats({ blockData, seedKey, stacks }),
        [blockData, seedKey, stacks],
    );
    const requestedPlan = useMemo(
        () =>
            planBatPopulation({
                availableSlots: 3,
                habitatSeeds: habitats.map((habitat) => habitat.seed),
            }),
        [habitats],
    );
    const requestedCount = requestedPlan.reduce(
        (total, group) => total + group.count,
        0,
    );
    const [claimedCount, setClaimedCount] = useState(0);
    const hiddenIdsRef = useRef(new Set<string>());

    useEffect(() => {
        if (!active || requestedCount <= 0 || claimedCount > 0) {
            return;
        }
        hiddenIdsRef.current.clear();
        setClaimedCount(
            globalBatPopulationRegistry.claim(ownerId, requestedCount),
        );
    }, [active, claimedCount, ownerId, requestedCount]);

    useEffect(() => {
        return () => globalBatPopulationRegistry.release(ownerId);
    }, [ownerId]);

    useEffect(() => {
        if (requestedCount > 0) {
            return;
        }
        globalBatPopulationRegistry.release(ownerId);
        hiddenIdsRef.current.clear();
        setClaimedCount(0);
    }, [ownerId, requestedCount]);

    const populationPlan = useMemo(
        () =>
            planBatPopulation({
                availableSlots: claimedCount,
                habitatSeeds: habitats.map((habitat) => habitat.seed),
            }),
        [claimedCount, habitats],
    );
    const renderedBatCount = populationPlan.reduce(
        (total, group) => total + group.count,
        0,
    );
    useSceneTimeInvalidation(
        'fauna:bats',
        claimedCount > 0,
        sceneFrameRates.ambient,
    );
    const onHidden = useCallback(
        (id: string) => {
            if (active) {
                return;
            }
            hiddenIdsRef.current.add(id);
            if (
                renderedBatCount > 0 &&
                hiddenIdsRef.current.size >= renderedBatCount
            ) {
                globalBatPopulationRegistry.release(ownerId);
                hiddenIdsRef.current.clear();
                setClaimedCount(0);
            }
        },
        [active, ownerId, renderedBatCount],
    );

    if (habitats.length === 0 || claimedCount <= 0) {
        return null;
    }

    return (
        <>
            {populationPlan.flatMap((group) => {
                const habitat = habitats[group.habitatIndex];
                if (!habitat) {
                    return [];
                }
                return Array.from({ length: group.count }, (_, index) => {
                    const id = `${habitat.id}:${index}`;
                    return (
                        <Bat
                            active={active}
                            habitat={habitat}
                            id={id}
                            index={index}
                            key={id}
                            onHidden={onHidden}
                        />
                    );
                });
            })}
        </>
    );
}
