import { useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    type Group,
    LoopOnce,
    LoopRepeat,
    MathUtils,
    type Mesh,
    Vector3,
} from 'three';
import { useGameFlags } from '../../GameFlagsContext';
import { useBlockData } from '../../hooks/useBlockData';
import {
    sceneFrameRates,
    useSceneFixedStepWork,
    useSceneRenderRequest,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
    useGameState,
    useGameStateStore,
} from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import { ActorSpeechBubble } from '../animals/ActorSpeechBubble';
import {
    type AnimalDebugPathPoint,
    AnimalPathDebugIndicator,
    AnimalTargetDebugMarker,
} from '../animals/AnimalDebugIndicators';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import { isFreshGardenAvatarPresence } from '../animals/animalAvatarFollowing';
import {
    canAnimalSettleAt,
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementYAt,
} from '../animals/animalMovementTerrain';
import { animalPresenceUpdateIntervalSeconds } from '../animals/animalPresence';
import type { CatPathPoint } from '../cats/catPathfinding';
import {
    chooseFrogEscapePlan,
    chooseFrogHopPlan,
    type FrogHopPlan,
    frogEscapeRepathCooldownSeconds,
    getFrogBlinkDelaySeconds,
    getFrogCroakDelaySeconds,
    getFrogDwellSeconds,
    getFrogFacingYaw,
    getFrogHopDurationSeconds,
    getFrogHopMotion,
    isAvatarNearFrog,
} from './frogBehavior';
import {
    createFrogHabitats,
    createFrogRandom,
    createFrogSpawnCandidates,
    createInitialFrogSpawnState,
    type FrogSpawnCandidate,
    type FrogTarget,
    frogMaxPopulation,
    frogMaxShallowWaterDepth,
    hashFrogSeed,
    reconcileFrogSpawns,
    reconcileFrogTarget,
} from './frogSpawning';

type FrogAnimationName = 'Frog_Blink' | 'Frog_Croak' | 'Frog_Hop' | 'Frog_Idle';

type SettledFrogState = {
    croakingUntil: number;
    dwellUntil: number;
    nextBlinkAt: number;
    nextCroakAt: number;
    phase: 'settled';
    target: FrogTarget;
};

type MovingFrogState = {
    duration: number;
    escape: boolean;
    from: Vector3;
    path: Vector3[];
    pathDistance: number;
    phase: 'moving';
    plan: FrogHopPlan;
    startedAt: number;
    target: FrogTarget;
};

type FrogRuntimeState = MovingFrogState | SettledFrogState;

function frogSpawnStatesEqual(
    left: ReturnType<typeof createInitialFrogSpawnState>,
    right: ReturnType<typeof createInitialFrogSpawnState>,
) {
    return (
        left.nextSpawnAt === right.nextSpawnAt &&
        left.sequence === right.sequence &&
        left.activeCandidateIds.length === right.activeCandidateIds.length &&
        left.activeCandidateIds.every(
            (candidateId, index) =>
                candidateId === right.activeCandidateIds[index],
        )
    );
}

const frogScale = 0.42;
const frogGroundLift = 0.018;
const frogSwimDepth = 0.055;
const frogDebugColor = '#84cc16';
const frogDebugBehaviors = ['idle', 'croak', 'hop', 'escape'];
const frogCroakDurationSeconds = 1.1;

function prepareFrogMesh(mesh: Mesh) {
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
}

function makeSettledState({
    now,
    random,
    target,
}: {
    now: number;
    random: () => number;
    target: FrogTarget;
}): SettledFrogState {
    return {
        croakingUntil: Number.NEGATIVE_INFINITY,
        dwellUntil: now + getFrogDwellSeconds(random),
        nextBlinkAt: now + getFrogBlinkDelaySeconds(random),
        nextCroakAt: now + getFrogCroakDelaySeconds(random),
        phase: 'settled',
        target,
    };
}

function makeMovingState({
    escape: isEscape,
    from,
    now,
    plan,
}: {
    escape: boolean;
    from: Vector3;
    now: number;
    plan: FrogHopPlan;
}): MovingFrogState {
    const path = plan.pathfinding.points.map(
        (point) => new Vector3(point.x, point.y, point.z),
    );
    return {
        duration: getFrogHopDurationSeconds({
            distance: plan.pathfinding.distance,
            escape: isEscape,
        }),
        escape: isEscape,
        from,
        path,
        pathDistance: plan.pathfinding.distance,
        phase: 'moving',
        plan,
        startedAt: now,
        target: plan.target,
    };
}

function pointAlongPath(points: Vector3[], progress: number) {
    const first = points[0];
    if (!first) {
        return new Vector3();
    }
    if (points.length === 1 || progress <= 0) {
        return first.clone();
    }

    let totalDistance = 0;
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        if (previous && current) {
            totalDistance += previous.distanceTo(current);
        }
    }
    if (totalDistance <= 0) {
        return first.clone();
    }

    let remaining = MathUtils.clamp(progress, 0, 1) * totalDistance;
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        if (!previous || !current) {
            continue;
        }
        const segmentDistance = previous.distanceTo(current);
        if (remaining <= segmentDistance) {
            return previous
                .clone()
                .lerp(
                    current,
                    segmentDistance > 0 ? remaining / segmentDistance : 1,
                );
        }
        remaining -= segmentDistance;
    }
    return points.at(-1)?.clone() ?? first.clone();
}

function facePoint(group: Group, target: Vector3, delta: number) {
    const dx = target.x - group.position.x;
    const dz = target.z - group.position.z;
    if (Math.hypot(dx, dz) <= 0.001) {
        return;
    }
    const desiredYaw = getFrogFacingYaw({ from: group.position, to: target });
    const deltaYaw = Math.atan2(
        Math.sin(desiredYaw - group.rotation.y),
        Math.cos(desiredYaw - group.rotation.y),
    );
    group.rotation.y += deltaYaw * (1 - Math.exp(-12 * delta));
}

function debugPathPoint(point: CatPathPoint): AnimalDebugPathPoint {
    return [point.x, point.y, point.z];
}

function roundPoint(point: Vector3) {
    return {
        x: Math.round(point.x * 100) / 100,
        y: Math.round(point.y * 100) / 100,
        z: Math.round(point.z * 100) / 100,
    };
}

function createFrogDebugEntry({
    candidate,
    group,
    now,
    runtime,
}: {
    candidate: FrogSpawnCandidate;
    group: Group;
    now: number;
    runtime: FrogRuntimeState;
}): AnimalDebugEntry {
    const croaking = runtime.phase === 'settled' && now < runtime.croakingUntil;
    const behavior =
        runtime.phase === 'moving'
            ? runtime.escape
                ? 'escape'
                : 'hop'
            : croaking
              ? 'croak'
              : 'idle';
    return {
        activity: 'environment-spawned wetland animal',
        behavior,
        debugBehaviors: frogDebugBehaviors,
        id: candidate.id,
        label: 'Žaba',
        phase: runtime.phase,
        position: roundPoint(group.position),
        species: 'Frog',
        targetId: runtime.target.id,
        updatedAt: now,
        ...(runtime.phase === 'moving'
            ? {
                  pathfinding: {
                      blockedCellCount:
                          runtime.plan.pathfinding.blockedCellCount,
                      distance: Math.round(runtime.pathDistance * 100) / 100,
                      status: runtime.plan.pathfinding.status,
                      targetCell: runtime.plan.pathfinding.targetCell,
                      visitedCellCount:
                          runtime.plan.pathfinding.visitedCellCount,
                      waypointCount: runtime.path.length,
                  },
              }
            : {}),
    };
}

function Frog({ candidate }: { candidate: FrogSpawnCandidate }) {
    const gltf = useGameGLTF('Frog');
    const { enableDebugHudFlag = false } = useGameFlags();
    const gameStateStore = useGameStateStore();
    const groupRef = useRef<Group>(null);
    const targetDebugRef = useRef<Group>(null);
    const randomRef = useRef(createFrogRandom(candidate.seed));
    const runtimeRef = useRef<FrogRuntimeState | null>(null);
    const activeAnimationRef = useRef<FrogAnimationName>('Frog_Idle');
    const lastDebugCommandSequenceRef = useRef(0);
    const lastDebugUpdateRef = useRef(0);
    const lastPresenceUpdateRef = useRef(0);
    const nextEscapeAtRef = useRef(Number.NEGATIVE_INFINITY);
    const [activeAnimation, setActiveAnimation] =
        useState<FrogAnimationName>('Frog_Idle');
    const [croakVisible, setCroakVisible] = useState(false);
    const [pathDebugPoints, setPathDebugPoints] = useState<
        AnimalDebugPathPoint[]
    >([]);
    const animalDebugCommand = useGameState(
        (state) => state.animalDebugCommand,
    );
    const animalPathfindingDebugVisible = useGameState(
        (state) => state.animalPathfindingDebugVisible,
    );
    const animalTargetsDebugVisible = useGameState(
        (state) => state.animalTargetsDebugVisible,
    );
    const setAnimalDebugEntry = useGameState(
        (state) => state.setAnimalDebugEntry,
    );
    const removeAnimalDebugEntry = useGameState(
        (state) => state.removeAnimalDebugEntry,
    );
    const setAnimalPresenceEntry = useGameState(
        (state) => state.setAnimalPresenceEntry,
    );
    const removeAnimalPresenceEntry = useGameState(
        (state) => state.removeAnimalPresenceEntry,
    );

    const frogModel = useMemo(() => {
        const scene = gltf.scene.clone(true);
        const { primaryCasterCount } = configureActorMeshShadows(
            scene,
            prepareFrogMesh,
        );
        return { primaryCasterCount, scene };
    }, [gltf.scene]);
    const { actions } = useAnimations(gltf.animations, frogModel.scene);
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: `frog:${candidate.id}`,
        primaryCasterCount: frogModel.primaryCasterCount,
        species: 'frog',
    });

    useEffect(() => {
        const action = actions[activeAnimation];
        if (!action) {
            return;
        }

        const repeating = activeAnimation === 'Frog_Idle';
        action.clampWhenFinished = !repeating;
        action.setLoop(
            repeating ? LoopRepeat : LoopOnce,
            repeating ? Infinity : 1,
        );
        action.reset().fadeIn(0.12).play();
        return () => {
            action.fadeOut(0.12);
        };
    }, [actions, activeAnimation]);

    useEffect(() => {
        if (!enableDebugHudFlag) {
            removeAnimalDebugEntry(candidate.id);
        }
        return () => removeAnimalDebugEntry(candidate.id);
    }, [candidate.id, enableDebugHudFlag, removeAnimalDebugEntry]);

    useEffect(
        () => () => removeAnimalPresenceEntry(candidate.id),
        [candidate.id, removeAnimalPresenceEntry],
    );

    useEffect(() => {
        if (!animalPathfindingDebugVisible) {
            setPathDebugPoints([]);
        }
    }, [animalPathfindingDebugVisible]);

    useEffect(() => {
        if (!animalTargetsDebugVisible && targetDebugRef.current) {
            targetDebugRef.current.visible = false;
        }
    }, [animalTargetsDebugVisible]);

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }

        const now = clock.elapsedTime;
        const random = randomRef.current;
        let runtime = runtimeRef.current;
        const setAnimation = (animation: FrogAnimationName) => {
            if (activeAnimationRef.current === animation) {
                return;
            }
            activeAnimationRef.current = animation;
            setActiveAnimation(animation);
        };
        const beginPlan = (plan: FrogHopPlan, isEscape: boolean) => {
            runtime = makeMovingState({
                escape: isEscape,
                from: group.position.clone(),
                now,
                plan,
            });
            runtimeRef.current = runtime;
            setPathDebugPoints(
                animalPathfindingDebugVisible
                    ? plan.pathfinding.points.map(debugPathPoint)
                    : [],
            );
        };

        if (!runtime) {
            group.position.set(
                candidate.startTarget.position.x,
                candidate.startTarget.position.y,
                candidate.startTarget.position.z,
            );
            runtime = makeSettledState({
                now,
                random,
                target: candidate.startTarget,
            });
            runtimeRef.current = runtime;
        }

        const reconciledTarget = reconcileFrogTarget(candidate, runtime.target);
        if (reconciledTarget.requiresReset) {
            group.position.set(
                reconciledTarget.target.position.x,
                reconciledTarget.target.position.y,
                reconciledTarget.target.position.z,
            );
            runtime = makeSettledState({
                now,
                random,
                target: reconciledTarget.target,
            });
            runtimeRef.current = runtime;
            setPathDebugPoints([]);
        } else if (reconciledTarget.target !== runtime.target) {
            runtime = { ...runtime, target: reconciledTarget.target };
            runtimeRef.current = runtime;
        }

        const { gardenAvatarPresence } = gameStateStore.getState();
        if (
            isFreshGardenAvatarPresence(gardenAvatarPresence, now) &&
            isAvatarNearFrog({
                avatar: gardenAvatarPresence.position,
                frog: group.position,
            }) &&
            now >= nextEscapeAtRef.current &&
            !(runtime.phase === 'moving' && runtime.escape)
        ) {
            const escapePlan = chooseFrogEscapePlan({
                avatar: gardenAvatarPresence.position,
                currentTarget: runtime.target,
                from: group.position,
                habitat: candidate.habitat,
            });
            if (escapePlan) {
                nextEscapeAtRef.current = now + frogEscapeRepathCooldownSeconds;
                beginPlan(escapePlan, true);
            }
        }

        if (
            animalDebugCommand &&
            animalDebugCommand.sequence !==
                lastDebugCommandSequenceRef.current &&
            animalDebugCommand.species === 'Frog'
        ) {
            lastDebugCommandSequenceRef.current = animalDebugCommand.sequence;
            if (
                !animalDebugCommand.targetId ||
                animalDebugCommand.targetId === candidate.id
            ) {
                if (animalDebugCommand.behavior === 'croak') {
                    runtime = {
                        ...makeSettledState({
                            now,
                            random,
                            target: runtime.target,
                        }),
                        croakingUntil: now + frogCroakDurationSeconds,
                    };
                    runtimeRef.current = runtime;
                } else if (animalDebugCommand.behavior === 'idle') {
                    runtime = {
                        ...makeSettledState({
                            now,
                            random,
                            target: runtime.target,
                        }),
                        dwellUntil: now + 30,
                    };
                    runtimeRef.current = runtime;
                } else if (animalDebugCommand.behavior === 'escape') {
                    const escapePlan = chooseFrogEscapePlan({
                        avatar: {
                            x: group.position.x - 0.4,
                            z: group.position.z - 0.4,
                        },
                        currentTarget: runtime.target,
                        from: group.position,
                        habitat: candidate.habitat,
                    });
                    if (escapePlan) {
                        beginPlan(escapePlan, true);
                    }
                } else if (animalDebugCommand.behavior === 'hop') {
                    const hopPlan = chooseFrogHopPlan({
                        currentTarget: runtime.target,
                        from: group.position,
                        habitat: candidate.habitat,
                        random,
                    });
                    if (hopPlan) {
                        beginPlan(hopPlan, false);
                    }
                }
            }
        }

        if (targetDebugRef.current) {
            targetDebugRef.current.visible = animalTargetsDebugVisible;
            targetDebugRef.current.position.set(
                runtime.target.position.x,
                runtime.target.position.y,
                runtime.target.position.z,
            );
        }

        if (runtime.phase === 'moving') {
            setAnimation('Frog_Hop');
            setCroakVisible(false);
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            const motion = getFrogHopMotion({
                distance: runtime.pathDistance,
                escape: runtime.escape,
                progress,
            });
            const nextPosition = pointAlongPath(
                runtime.path,
                motion.travelProgress,
            );
            nextPosition.y += motion.arcHeight;
            const lookAhead = pointAlongPath(
                runtime.path,
                MathUtils.clamp(motion.travelProgress + 0.08, 0, 1),
            );
            group.position.copy(nextPosition);
            facePoint(group, lookAhead, delta);

            if (progress >= 1) {
                const destination = runtime.target.position;
                if (
                    canAnimalSettleAt(destination, candidate.habitat.surfaces, {
                        habitat: 'wetland',
                        waterMaxDepth: frogMaxShallowWaterDepth,
                    })
                ) {
                    group.position.set(
                        destination.x,
                        destination.y,
                        destination.z,
                    );
                }
                runtimeRef.current = makeSettledState({
                    now,
                    random,
                    target: runtime.target,
                });
                setPathDebugPoints([]);
            }
            return;
        }

        group.position.set(
            runtime.target.position.x,
            runtime.target.position.y,
            runtime.target.position.z,
        );
        const croaking = now < runtime.croakingUntil;
        setAnimation(croaking ? 'Frog_Croak' : 'Frog_Idle');
        setCroakVisible(croaking);

        if (now >= runtime.nextBlinkAt && !croaking) {
            const blinkAction = actions.Frog_Blink;
            if (blinkAction) {
                blinkAction.clampWhenFinished = false;
                blinkAction.setLoop(LoopOnce, 1).reset().fadeIn(0.05).play();
            }
            runtime = {
                ...runtime,
                nextBlinkAt: now + getFrogBlinkDelaySeconds(random),
            };
            runtimeRef.current = runtime;
        }

        if (now >= runtime.nextCroakAt && !croaking) {
            runtimeRef.current = {
                ...runtime,
                croakingUntil: now + frogCroakDurationSeconds,
                nextCroakAt: now + getFrogCroakDelaySeconds(random),
            };
            return;
        }

        if (now < runtime.dwellUntil || croaking) {
            return;
        }

        const plan = chooseFrogHopPlan({
            currentTarget: runtime.target,
            from: group.position,
            habitat: candidate.habitat,
            random,
        });
        if (plan) {
            beginPlan(plan, false);
        } else {
            runtimeRef.current = makeSettledState({
                now,
                random,
                target: runtime.target,
            });
        }
    });

    useFrame(({ clock }) => {
        const group = groupRef.current;
        const runtime = runtimeRef.current;
        if (!group || !runtime) {
            return;
        }
        const now = clock.elapsedTime;

        if (updateActorGroundingShadow) {
            updateActorGroundingShadow({
                actorY: group.position.y,
                receiverY: getAnimalMovementYAt(
                    group.position,
                    candidate.habitat.surfaces,
                ),
                visible: group.visible && frogModel.scene.visible,
                x: group.position.x,
                yaw: group.rotation.y,
                z: group.position.z,
            });
        }

        if (
            now - lastPresenceUpdateRef.current >=
            animalPresenceUpdateIntervalSeconds
        ) {
            lastPresenceUpdateRef.current = now;
            setAnimalPresenceEntry({
                behavior:
                    runtime.phase === 'moving'
                        ? runtime.escape
                            ? 'escape'
                            : 'hop'
                        : now < runtime.croakingUntil
                          ? 'croak'
                          : 'idle',
                id: candidate.id,
                position: roundPoint(group.position),
                species: 'Frog',
                updatedAt: now,
            });
        }

        if (enableDebugHudFlag && now - lastDebugUpdateRef.current >= 0.5) {
            lastDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createFrogDebugEntry({ candidate, group, now, runtime }),
            );
        }
    });

    return (
        <>
            <group ref={groupRef} scale={frogScale}>
                <primitive object={frogModel.scene} />
            </group>
            {croakVisible ? (
                <ActorSpeechBubble
                    actorRef={groupRef}
                    message="Kre-kre!"
                    offsetY={0.42}
                />
            ) : null}
            <AnimalTargetDebugMarker
                ref={targetDebugRef}
                color={frogDebugColor}
            />
            <AnimalPathDebugIndicator
                color={frogDebugColor}
                points={pathDebugPoints}
                visible={animalPathfindingDebugVisible}
            />
        </>
    );
}

export function Frogs({
    gardenId,
    stacks,
}: {
    gardenId?: number | string | null;
    stacks: Stack[] | undefined;
}) {
    const { data: blockData } = useBlockData();
    const [spawnState, setSpawnState] = useState(createInitialFrogSpawnState);
    const surfaces = useMemo(
        () =>
            createAnimalMovementSurfaces({
                blockData,
                groundLift: frogGroundLift,
                stacks,
                swimDepth: frogSwimDepth,
            }),
        [blockData, stacks],
    );
    const blockedCells = useMemo(
        () => createAnimalBlockedCells(stacks),
        [stacks],
    );
    const candidates = useMemo(
        () =>
            createFrogSpawnCandidates(
                createFrogHabitats({ blockedCells, surfaces }),
            ),
        [blockedCells, surfaces],
    );
    const seed = useMemo(
        () => hashFrogSeed(`garden:${gardenId ?? 'public'}:frog`),
        [gardenId],
    );
    const requestRender = useSceneRenderRequest();
    const reconcileSpawns = useCallback(
        (now: number) => {
            setSpawnState((previous) => {
                const next = reconcileFrogSpawns({
                    candidates,
                    now,
                    previous,
                    seed,
                });
                return frogSpawnStatesEqual(previous, next) ? previous : next;
            });
        },
        [candidates, seed],
    );

    useEffect(() => {
        reconcileSpawns(globalThis.performance.now() / 1000);
    }, [reconcileSpawns]);
    const frogPopulationIncomplete =
        spawnState.activeCandidateIds.length <
        Math.min(frogMaxPopulation, candidates.length);
    useSceneFixedStepWork({
        callback: ({ nowMs }) => reconcileSpawns(nowMs / 1000),
        enabled: frogPopulationIncomplete,
        maxDeltaMs: 1000,
        owner: 'fauna:frogs:population',
        stepsPerSecond: 1,
    });
    const activeFrogCount = spawnState.activeCandidateIds.length;
    useEffect(() => {
        requestRender(
            activeFrogCount > 0
                ? 'fauna:frogs:population-active'
                : 'fauna:frogs:population-empty',
        );
    }, [activeFrogCount, requestRender]);

    const candidatesById = useMemo(
        () => new Map(candidates.map((candidate) => [candidate.id, candidate])),
        [candidates],
    );
    const activeCandidates = spawnState.activeCandidateIds.flatMap((id) => {
        const candidate = candidatesById.get(id);
        return candidate ? [candidate] : [];
    });
    useSceneTimeInvalidation(
        'fauna:frogs',
        activeCandidates.length > 0,
        sceneFrameRates.ambient,
    );

    return (
        <>
            {activeCandidates.map((candidate) => (
                <Frog key={candidate.id} candidate={candidate} />
            ))}
        </>
    );
}
