import { useAnimations } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    type AnimationAction,
    type Group,
    LoopRepeat,
    MathUtils,
    type Mesh,
    Vector3,
} from 'three';
import { useGameFlags } from '../../GameFlagsContext';
import { useBlockData } from '../../hooks/useBlockData';
import {
    sceneFrameRates,
    useSceneDeadline,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import { type AnimalDebugEntry, useGameState } from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import {
    ActorSpeechBubble,
    useActorHoverSpeech,
} from '../animals/ActorSpeechBubble';
import {
    type AnimalDebugPathPoint,
    AnimalPathDebugIndicator,
    AnimalTargetDebugMarker,
} from '../animals/AnimalDebugIndicators';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import { squirrelSpeechMessages } from '../animals/actorSpeechMessages';
import { isFreshGardenAvatarPresence } from '../animals/animalAvatarFollowing';
import { getAnimalMovementYAt } from '../animals/animalMovementTerrain';
import { animalPresenceUpdateIntervalSeconds } from '../animals/animalPresence';
import {
    getSquirrelDwellSeconds,
    getSquirrelMovementRange,
    pickSquirrelRoutineBehavior,
    type SquirrelBehavior,
    type SquirrelRoutineBehavior,
} from './squirrelBehavior';
import {
    createSquirrelHabitats,
    type SquirrelHabitat,
    type SquirrelTarget,
} from './squirrelHabitat';
import {
    findSquirrelPath,
    type SquirrelPathResult,
} from './squirrelPathfinding';
import {
    createSquirrelRandom,
    createSquirrelSpawnPlan,
    getSquirrelCooldownRemainingMs,
    getSquirrelVisitDurationSeconds,
    reconcileSquirrelCooldowns,
    type SquirrelSpawnCooldown,
} from './squirrelSpawning';

type SquirrelMovingBehavior = Extract<
    SquirrelBehavior,
    'scamper' | 'bound' | 'flee'
>;
type SquirrelSettledBehavior = Extract<
    SquirrelBehavior,
    'sit' | 'forage' | 'pause'
>;

type MovingSquirrelState = {
    behavior: SquirrelMovingBehavior;
    despawnOnArrival: boolean;
    duration: number;
    from: Vector3;
    path: Vector3[];
    pathDistance: number;
    pathfinding: SquirrelPathResult;
    phase: 'moving';
    startedAt: number;
    target: SquirrelTarget;
};

type SettledSquirrelState = {
    behavior: SquirrelSettledBehavior;
    dwellUntil: number;
    phase: 'settled';
    target: SquirrelTarget;
};

type ExitingSquirrelState = {
    behavior: 'flee';
    destination: Vector3;
    from: Vector3;
    phase: 'exiting';
    startedAt: number;
    target: SquirrelTarget;
};

type SquirrelRuntimeState =
    | MovingSquirrelState
    | SettledSquirrelState
    | ExitingSquirrelState;

type SquirrelAnimationName =
    | 'Squirrel_Scamper'
    | 'Squirrel_Bound'
    | 'Squirrel_Sit'
    | 'Squirrel_Forage'
    | 'Squirrel_Pause'
    | 'Squirrel_Flee';

export const squirrelActorScale = 0.2;
const squirrelSpeechBubbleOffsetY = 0.48;
const squirrelAvatarFleeDistance = 2.2;
const squirrelFleeReactionCooldownSeconds = 4;
const squirrelTreeExitSeconds = 0.34;
const squirrelTreeExitTrunkClearance = 0.24;
const squirrelTurnDamping = 12;
const squirrelPathDebugColor = '#ea580c';
const fullTurn = Math.PI * 2;

const squirrelDebugBehaviors = [
    'scamper',
    'bound',
    'sit',
    'forage',
    'pause',
    'flee',
] satisfies SquirrelBehavior[];

const animationByBehavior = {
    scamper: 'Squirrel_Scamper',
    bound: 'Squirrel_Bound',
    sit: 'Squirrel_Sit',
    forage: 'Squirrel_Forage',
    pause: 'Squirrel_Pause',
    flee: 'Squirrel_Flee',
} satisfies Record<SquirrelBehavior, SquirrelAnimationName>;

function horizontalDistance(
    left: Pick<Vector3, 'x' | 'z'>,
    right: Pick<Vector3, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function pathHorizontalDistance(path: Vector3[]) {
    let distance = 0;
    for (let index = 1; index < path.length; index += 1) {
        const previous = path[index - 1];
        const current = path[index];
        if (previous && current) {
            distance += horizontalDistance(previous, current);
        }
    }
    return distance;
}

function pathPositionAtDistance(path: Vector3[], distance: number) {
    const first = path[0];
    if (!first || distance <= 0) {
        return first?.clone() ?? new Vector3();
    }

    let remainingDistance = distance;
    for (let index = 1; index < path.length; index += 1) {
        const from = path[index - 1];
        const to = path[index];
        if (!from || !to) {
            continue;
        }
        const segmentDistance = horizontalDistance(from, to);
        if (segmentDistance <= 0.0001) {
            continue;
        }
        if (remainingDistance <= segmentDistance) {
            return from.clone().lerp(to, remainingDistance / segmentDistance);
        }
        remainingDistance -= segmentDistance;
    }

    return path.at(-1)?.clone() ?? first.clone();
}

function facePosition(group: Group, target: Vector3, delta: number) {
    const x = target.x - group.position.x;
    const z = target.z - group.position.z;
    if (Math.hypot(x, z) <= 0.001) {
        return;
    }

    const targetYaw = Math.atan2(x, z);
    const difference =
        MathUtils.euclideanModulo(
            targetYaw - group.rotation.y + Math.PI,
            fullTurn,
        ) - Math.PI;
    group.rotation.y +=
        difference * (1 - Math.exp(-squirrelTurnDamping * delta));
}

function squirrelMovementSpeed(behavior: SquirrelMovingBehavior) {
    if (behavior === 'flee') {
        return 2.05;
    }
    if (behavior === 'bound') {
        return 1.42;
    }
    return 1.02;
}

function createMovingState({
    behavior,
    despawnOnArrival = false,
    from,
    habitat,
    now,
    target,
}: {
    behavior: SquirrelMovingBehavior;
    despawnOnArrival?: boolean;
    from: Vector3;
    habitat: SquirrelHabitat;
    now: number;
    target: SquirrelTarget;
}): MovingSquirrelState | null {
    const pathfinding = findSquirrelPath({
        blockedCells: habitat.blockedCells,
        from,
        surfaces: habitat.groundSurfaces,
        to: target.position,
    });
    if (pathfinding.status === 'unreachable') {
        return null;
    }

    const path = pathfinding.points.map(
        (point) => new Vector3(point.x, point.y, point.z),
    );
    const pathDistance = pathHorizontalDistance(path);
    if (pathDistance <= 0.02) {
        return null;
    }

    return {
        behavior,
        despawnOnArrival,
        duration: MathUtils.clamp(
            pathDistance / squirrelMovementSpeed(behavior),
            behavior === 'flee' ? 0.28 : 0.45,
            behavior === 'flee' ? 4 : 6,
        ),
        from,
        path,
        pathDistance,
        pathfinding,
        phase: 'moving',
        startedAt: now,
        target,
    };
}

function createSettledState({
    behavior,
    now,
    random,
    target,
}: {
    behavior: SquirrelSettledBehavior;
    now: number;
    random: () => number;
    target: SquirrelTarget;
}): SettledSquirrelState {
    return {
        behavior,
        dwellUntil: now + getSquirrelDwellSeconds({ behavior, random }),
        phase: 'settled',
        target,
    };
}

function createExitingState({
    from,
    habitat,
    now,
    target,
}: {
    from: Vector3;
    habitat: SquirrelHabitat;
    now: number;
    target: SquirrelTarget;
}): ExitingSquirrelState {
    const treeDirection = target.position
        .clone()
        .sub(habitat.treePosition)
        .setY(0);
    if (treeDirection.lengthSq() <= 0.0001) {
        treeDirection.set(0, 0, 1);
    }
    treeDirection.setLength(squirrelTreeExitTrunkClearance);
    const destination = habitat.treePosition
        .clone()
        .add(treeDirection)
        .setY(target.position.y);

    return {
        behavior: 'flee',
        destination,
        from: from.clone(),
        phase: 'exiting',
        startedAt: now,
        target,
    };
}

export function createScheduledDepartureState({
    from,
    habitat,
    now,
}: {
    from: Vector3;
    habitat: SquirrelHabitat;
    now: number;
}) {
    if (horizontalDistance(from, habitat.spawnTarget.position) <= 0.02) {
        return createExitingState({
            from,
            habitat,
            now,
            target: habitat.spawnTarget,
        });
    }
    return (
        createMovingState({
            behavior: 'flee',
            despawnOnArrival: true,
            from: from.clone(),
            habitat,
            now,
            target: habitat.spawnTarget,
        }) ?? {
            behavior: 'flee',
            destination: from.clone(),
            from: from.clone(),
            phase: 'exiting',
            startedAt: now,
            target: habitat.spawnTarget,
        }
    );
}

function chooseSettledBehavior(random: () => number): SquirrelSettledBehavior {
    const value = random();
    if (value < 0.45) {
        return 'forage';
    }
    if (value < 0.78) {
        return 'sit';
    }
    return 'pause';
}

function shuffledTargets(targets: SquirrelTarget[], random: () => number) {
    return targets
        .map((target) => ({ rank: random(), target }))
        .sort(
            (left, right) =>
                left.rank - right.rank ||
                left.target.id.localeCompare(right.target.id),
        )
        .map(({ target }) => target);
}

function chooseRoutineMovement({
    behavior,
    currentTarget,
    from,
    habitat,
    now,
    random,
}: {
    behavior: Extract<SquirrelRoutineBehavior, 'scamper' | 'bound'>;
    currentTarget: SquirrelTarget;
    from: Vector3;
    habitat: SquirrelHabitat;
    now: number;
    random: () => number;
}) {
    const range = getSquirrelMovementRange(behavior);
    const candidates = habitat.roamTargets.filter(
        (target) =>
            target.id !== currentTarget.id &&
            horizontalDistance(from, target.position) <= range,
    );

    for (const target of shuffledTargets(candidates, random)) {
        const moving = createMovingState({
            behavior,
            from: from.clone(),
            habitat,
            now,
            target,
        });
        if (moving) {
            return moving;
        }
    }

    return null;
}

export function chooseSquirrelFleeState({
    avatarPosition,
    from,
    habitat,
    now,
}: {
    avatarPosition: Vector3;
    from: Vector3;
    habitat: SquirrelHabitat;
    now: number;
}) {
    const currentDistance = horizontalDistance(from, avatarPosition);
    const escapeTargets = [...habitat.escapeTargets].sort(
        (left, right) =>
            horizontalDistance(right.position, avatarPosition) -
                horizontalDistance(left.position, avatarPosition) ||
            left.id.localeCompare(right.id),
    );

    for (const target of escapeTargets) {
        if (
            horizontalDistance(target.position, avatarPosition) <
            currentDistance + 0.15
        ) {
            continue;
        }
        const moving = createMovingState({
            behavior: 'flee',
            despawnOnArrival: true,
            from: from.clone(),
            habitat,
            now,
            target,
        });
        if (moving) {
            return moving;
        }
    }

    const fallbackTargets = [...habitat.roamTargets].sort(
        (left, right) =>
            horizontalDistance(right.position, avatarPosition) -
                horizontalDistance(left.position, avatarPosition) ||
            left.id.localeCompare(right.id),
    );
    for (const target of fallbackTargets) {
        if (
            horizontalDistance(target.position, avatarPosition) <
            currentDistance + 0.25
        ) {
            continue;
        }
        const moving = createMovingState({
            behavior: 'flee',
            from: from.clone(),
            habitat,
            now,
            target,
        });
        if (moving) {
            return moving;
        }
    }

    return null;
}

function createDebugEntry({
    group,
    habitat,
    now,
    runtime,
}: {
    group: Group;
    habitat: SquirrelHabitat;
    now: number;
    runtime: SquirrelRuntimeState;
}): AnimalDebugEntry {
    const moving = runtime.phase === 'moving' ? runtime : null;
    const nextWaypoint = moving?.path[1];
    return {
        activity: runtime.phase === 'exiting' ? 'tree-exit' : runtime.behavior,
        behavior: runtime.behavior,
        debugBehaviors: squirrelDebugBehaviors,
        id: habitat.id,
        label: 'Vjeverica',
        pathfinding: moving
            ? {
                  blockedCellCount: moving.pathfinding.blockedCellCount,
                  distance: moving.pathfinding.distance,
                  nextWaypoint: nextWaypoint
                      ? {
                            x: nextWaypoint.x,
                            y: nextWaypoint.y,
                            z: nextWaypoint.z,
                        }
                      : undefined,
                  status: moving.pathfinding.status,
                  targetCell: moving.pathfinding.targetCell,
                  visitedCellCount: moving.pathfinding.visitedCellCount,
                  waypointCount: moving.path.length,
              }
            : undefined,
        phase: runtime.phase,
        position: {
            x: Number(group.position.x.toFixed(3)),
            y: Number(group.position.y.toFixed(3)),
            z: Number(group.position.z.toFixed(3)),
        },
        species: 'Squirrel',
        targetId: runtime.target.id,
        updatedAt: now,
    };
}

function animationTimeScale(
    runtime: SquirrelRuntimeState | null,
    action: AnimationAction | null | undefined,
) {
    if (runtime?.phase !== 'moving') {
        return 1;
    }
    const clipDuration = action?.getClip().duration ?? 1;
    const speed = squirrelMovementSpeed(runtime.behavior);
    return MathUtils.clamp(speed * clipDuration * 0.9, 0.72, 1.85);
}

function Squirrel({
    habitat,
    onDespawn,
    spawnSequence,
}: {
    habitat: SquirrelHabitat;
    onDespawn: (habitatId: string) => void;
    spawnSequence: number;
}) {
    const gltf = useGameGLTF('Squirrel');
    const { enableDebugHudFlag = false } = useGameFlags();
    const clock = useThree((state) => state.clock);
    const groupRef = useRef<Group>(null);
    const targetDebugRef = useRef<Group>(null);
    const randomRef = useRef(
        createSquirrelRandom(habitat.seed + spawnSequence * 7919),
    );
    const runtimeRef = useRef<SquirrelRuntimeState | null>(null);
    const activeAnimationRef = useRef<SquirrelAnimationName>('Squirrel_Pause');
    const lastDebugUpdateRef = useRef(0);
    const lastPresenceUpdateRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const lastFleeAtRef = useRef(Number.NEGATIVE_INFINITY);
    const visitEndsAtRef = useRef<number | null>(null);
    const despawnedRef = useRef(false);
    const pathDebugKeyRef = useRef('');
    const [activeAnimation, setActiveAnimation] =
        useState<SquirrelAnimationName>('Squirrel_Pause');
    const [pathDebugPoints, setPathDebugPoints] = useState<
        AnimalDebugPathPoint[]
    >([]);
    const { message: speechMessage, showMessage: showSpeechMessage } =
        useActorHoverSpeech(squirrelSpeechMessages);
    const animalPathfindingDebugVisible = useGameState(
        (state) => state.animalPathfindingDebugVisible,
    );
    const animalTargetsDebugVisible = useGameState(
        (state) => state.animalTargetsDebugVisible,
    );
    const animalDebugCommand = useGameState(
        (state) => state.animalDebugCommand,
    );
    const gardenAvatarPresence = useGameState(
        (state) => state.gardenAvatarPresence,
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

    const squirrelModel = useMemo(() => {
        const clone = gltf.scene.clone(true);
        const { primaryCasterCount } = configureActorMeshShadows(
            clone,
            (object: Mesh) => {
                object.receiveShadow = true;
            },
        );
        return { primaryCasterCount, scene: clone };
    }, [gltf.scene]);
    const { actions } = useAnimations(gltf.animations, squirrelModel.scene);
    const updateGroundingShadow = useActorGroundingShadow({
        id: `squirrel:${habitat.id}`,
        primaryCasterCount: squirrelModel.primaryCasterCount,
        species: 'squirrel',
    });

    const setAnimation = (animation: SquirrelAnimationName) => {
        if (activeAnimationRef.current === animation) {
            return;
        }
        activeAnimationRef.current = animation;
        setActiveAnimation(animation);
    };

    useEffect(() => {
        const action = actions[activeAnimation];
        if (!action) {
            return;
        }
        action.timeScale = animationTimeScale(runtimeRef.current, action);
        action.reset().setLoop(LoopRepeat, Number.POSITIVE_INFINITY);
        action.fadeIn(0.16).play();
        return () => {
            action.fadeOut(0.16);
        };
    }, [actions, activeAnimation]);

    useEffect(() => {
        const group = groupRef.current;
        if (!group || runtimeRef.current) {
            return;
        }
        group.position.copy(habitat.spawnTarget.position);
        group.rotation.y = Math.atan2(
            habitat.treePosition.x - group.position.x,
            habitat.treePosition.z - group.position.z,
        );
    }, [habitat.spawnTarget.position, habitat.treePosition]);

    useEffect(() => {
        if (!enableDebugHudFlag) {
            removeAnimalDebugEntry(habitat.id);
        }
        return () => removeAnimalDebugEntry(habitat.id);
    }, [enableDebugHudFlag, habitat.id, removeAnimalDebugEntry]);

    useEffect(
        () => () => removeAnimalPresenceEntry(habitat.id),
        [habitat.id, removeAnimalPresenceEntry],
    );

    useEffect(() => {
        if (!animalTargetsDebugVisible && targetDebugRef.current) {
            targetDebugRef.current.visible = false;
        }
    }, [animalTargetsDebugVisible]);

    useEffect(() => {
        if (!animalPathfindingDebugVisible) {
            pathDebugKeyRef.current = '';
            setPathDebugPoints([]);
        }
    }, [animalPathfindingDebugVisible]);

    const syncDebugIndicators = (runtime: SquirrelRuntimeState | null) => {
        const targetDebug = targetDebugRef.current;
        if (targetDebug) {
            targetDebug.visible = animalTargetsDebugVisible && runtime !== null;
            if (targetDebug.visible && runtime) {
                targetDebug.position.copy(runtime.target.position);
            }
        }

        const key =
            animalPathfindingDebugVisible && runtime?.phase === 'moving'
                ? runtime.path
                      .map(
                          (point) =>
                              `${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`,
                      )
                      .join('|')
                : '';
        if (pathDebugKeyRef.current === key) {
            return;
        }
        pathDebugKeyRef.current = key;
        setPathDebugPoints(
            key && runtime?.phase === 'moving'
                ? runtime.path.map((point) => [point.x, point.y, point.z])
                : [],
        );
    };

    function handlePointerDown(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
    }

    function handlePointerOver(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        showSpeechMessage();
    }

    function handleClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        const group = groupRef.current;
        const runtime = runtimeRef.current;
        if (!group || !runtime || runtime.phase === 'exiting') {
            return;
        }
        const currentTarget = runtime.target;
        const moving = chooseRoutineMovement({
            behavior: 'bound',
            currentTarget,
            from: group.position,
            habitat,
            now: clock.elapsedTime,
            random: randomRef.current,
        });
        if (moving) {
            runtimeRef.current = moving;
            syncDebugIndicators(moving);
        }
    }

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group || despawnedRef.current) {
            return;
        }
        const now = clock.elapsedTime;
        const random = randomRef.current;
        let runtime = runtimeRef.current;

        if (!runtime) {
            runtime = createSettledState({
                behavior: 'pause',
                now,
                random,
                target: habitat.spawnTarget,
            });
            runtimeRef.current = runtime;
            group.position.copy(habitat.spawnTarget.position);
            visitEndsAtRef.current ??=
                now +
                getSquirrelVisitDurationSeconds({
                    habitatSeed: habitat.seed,
                    spawnSequence,
                });
        }

        if (
            animalDebugCommand &&
            animalDebugCommand.sequence !==
                lastDebugCommandSequenceRef.current &&
            animalDebugCommand.species === 'Squirrel'
        ) {
            lastDebugCommandSequenceRef.current = animalDebugCommand.sequence;
            if (
                !animalDebugCommand.targetId ||
                animalDebugCommand.targetId === habitat.id
            ) {
                const behavior = squirrelDebugBehaviors.find(
                    (candidate) => candidate === animalDebugCommand.behavior,
                );
                if (behavior === 'flee') {
                    const target = habitat.escapeTargets[0];
                    const moving = target
                        ? createMovingState({
                              behavior,
                              despawnOnArrival: true,
                              from: group.position.clone(),
                              habitat,
                              now,
                              target,
                          })
                        : null;
                    if (moving) {
                        runtime = moving;
                    }
                } else if (behavior === 'scamper' || behavior === 'bound') {
                    runtime =
                        chooseRoutineMovement({
                            behavior,
                            currentTarget: runtime.target,
                            from: group.position,
                            habitat,
                            now,
                            random,
                        }) ?? runtime;
                } else if (
                    behavior === 'sit' ||
                    behavior === 'forage' ||
                    behavior === 'pause'
                ) {
                    runtime = createSettledState({
                        behavior,
                        now,
                        random,
                        target: runtime.target,
                    });
                }
                runtimeRef.current = runtime;
            }
        }

        if (
            runtime.phase !== 'exiting' &&
            runtime.behavior !== 'flee' &&
            now >= (visitEndsAtRef.current ?? Number.POSITIVE_INFINITY)
        ) {
            const departure = createScheduledDepartureState({
                from: group.position,
                habitat,
                now,
            });
            if (departure) {
                runtime = departure;
                runtimeRef.current = runtime;
            }
        }

        if (
            runtime.phase !== 'exiting' &&
            runtime.behavior !== 'flee' &&
            now - lastFleeAtRef.current >=
                squirrelFleeReactionCooldownSeconds &&
            isFreshGardenAvatarPresence(gardenAvatarPresence, now)
        ) {
            const avatarPosition = new Vector3(
                gardenAvatarPresence.position.x,
                gardenAvatarPresence.position.y,
                gardenAvatarPresence.position.z,
            );
            if (
                horizontalDistance(group.position, avatarPosition) <=
                squirrelAvatarFleeDistance
            ) {
                const flee = chooseSquirrelFleeState({
                    avatarPosition,
                    from: group.position,
                    habitat,
                    now,
                });
                if (flee) {
                    lastFleeAtRef.current = now;
                    runtime = flee;
                    runtimeRef.current = runtime;
                }
            }
        }

        if (runtime.phase === 'moving') {
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            const distance = runtime.pathDistance * progress;
            const position = pathPositionAtDistance(runtime.path, distance);
            position.y = getAnimalMovementYAt(position, habitat.groundSurfaces);
            group.position.copy(position);
            const lookAhead = pathPositionAtDistance(
                runtime.path,
                Math.min(runtime.pathDistance, distance + 0.18),
            );
            facePosition(group, lookAhead, delta);
            setAnimation(animationByBehavior[runtime.behavior]);

            if (progress >= 1) {
                if (runtime.despawnOnArrival) {
                    runtime = createExitingState({
                        from: group.position,
                        habitat,
                        now,
                        target: runtime.target,
                    });
                } else {
                    runtime = createSettledState({
                        behavior: chooseSettledBehavior(random),
                        now,
                        random,
                        target: runtime.target,
                    });
                }
                runtimeRef.current = runtime;
            }
        } else if (runtime.phase === 'exiting') {
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / squirrelTreeExitSeconds,
                0,
                1,
            );
            group.position.lerpVectors(
                runtime.from,
                runtime.destination,
                progress,
            );
            group.scale.setScalar(squirrelActorScale * (1 - progress));
            setAnimation('Squirrel_Flee');
            if (progress >= 1) {
                group.visible = false;
                despawnedRef.current = true;
                onDespawn(habitat.id);
                return;
            }
        } else {
            setAnimation(animationByBehavior[runtime.behavior]);
            if (now >= runtime.dwellUntil) {
                const behavior = pickSquirrelRoutineBehavior(random);
                if (behavior === 'scamper' || behavior === 'bound') {
                    runtime =
                        chooseRoutineMovement({
                            behavior,
                            currentTarget: runtime.target,
                            from: group.position,
                            habitat,
                            now,
                            random,
                        }) ??
                        createSettledState({
                            behavior: 'pause',
                            now,
                            random,
                            target: runtime.target,
                        });
                } else {
                    runtime = createSettledState({
                        behavior,
                        now,
                        random,
                        target: runtime.target,
                    });
                }
                runtimeRef.current = runtime;
            }
        }

        syncDebugIndicators(runtime);

        if (updateGroundingShadow) {
            updateGroundingShadow({
                actorY: group.position.y,
                receiverY: getAnimalMovementYAt(
                    group.position,
                    habitat.groundSurfaces,
                ),
                visible: group.visible && runtime.phase !== 'exiting',
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
                behavior: runtime.behavior,
                id: habitat.id,
                position: {
                    x: Number(group.position.x.toFixed(3)),
                    y: Number(group.position.y.toFixed(3)),
                    z: Number(group.position.z.toFixed(3)),
                },
                species: 'Squirrel',
                updatedAt: now,
            });
        }

        if (enableDebugHudFlag && now - lastDebugUpdateRef.current >= 0.5) {
            lastDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createDebugEntry({ group, habitat, now, runtime }),
            );
        }
    });

    return (
        <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js actor is intentionally interactive */}
            <group
                ref={groupRef}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
                onPointerOver={handlePointerOver}
                scale={squirrelActorScale}
            >
                <primitive object={squirrelModel.scene} />
            </group>
            {speechMessage ? (
                <ActorSpeechBubble
                    actorRef={groupRef}
                    message={speechMessage}
                    offsetY={squirrelSpeechBubbleOffsetY}
                />
            ) : null}
            <AnimalTargetDebugMarker
                ref={targetDebugRef}
                color={squirrelPathDebugColor}
            />
            <AnimalPathDebugIndicator
                color={squirrelPathDebugColor}
                points={pathDebugPoints}
                visible={animalPathfindingDebugVisible}
            />
        </>
    );
}

export function Squirrels({
    farmId,
    stacks,
}: {
    farmId?: number | null;
    stacks: Stack[] | undefined;
}) {
    const { data: blockData } = useBlockData();
    const gardenSeed =
        farmId === null || farmId === undefined
            ? 'local-sandbox'
            : `farm-${farmId.toString()}`;
    const habitats = useMemo(
        () => createSquirrelHabitats({ blockData, gardenSeed, stacks }),
        [blockData, gardenSeed, stacks],
    );
    const habitatById = useMemo(
        () => new Map(habitats.map((habitat) => [habitat.id, habitat])),
        [habitats],
    );
    const [cooldowns, setCooldowns] = useState(
        () => new Map<string, SquirrelSpawnCooldown>(),
    );
    const [now, setNow] = useState(Date.now);
    const spawnPlan = useMemo(
        () =>
            createSquirrelSpawnPlan({
                cooldowns,
                gardenSeed,
                habitats,
                now,
            }),
        [cooldowns, gardenSeed, habitats, now],
    );
    useSceneTimeInvalidation(
        'fauna:squirrels',
        spawnPlan.length > 0,
        sceneFrameRates.ambient,
    );

    useEffect(() => {
        setCooldowns((current) =>
            reconcileSquirrelCooldowns({
                cooldowns: current,
                habitats,
            }),
        );
    }, [habitats]);

    const nextCooldownDelayMs = useMemo(() => {
        let nextDelay = Number.POSITIVE_INFINITY;
        for (const habitat of habitats) {
            const remaining = getSquirrelCooldownRemainingMs({
                cooldown: cooldowns.get(habitat.id),
                now,
            });
            if (remaining > 0) {
                nextDelay = Math.min(nextDelay, remaining);
            }
        }
        return Number.isFinite(nextDelay) ? Math.max(25, nextDelay + 1) : null;
    }, [cooldowns, habitats, now]);
    const cooldownDeadlineMs = useMemo(
        () =>
            nextCooldownDelayMs === null
                ? null
                : globalThis.performance.now() + nextCooldownDelayMs,
        [nextCooldownDelayMs],
    );
    useSceneDeadline({
        callback: () => setNow(Date.now()),
        deadlineMs: cooldownDeadlineMs,
        owner: 'fauna:squirrels:cooldown',
    });

    const handleDespawn = useCallback((habitatId: string) => {
        const despawnedAt = Date.now();
        setCooldowns((current) => {
            const next = new Map(current);
            const previous = next.get(habitatId);
            next.set(habitatId, {
                lastDespawnedAt: despawnedAt,
                spawnSequence: (previous?.spawnSequence ?? 0) + 1,
            });
            return next;
        });
        setNow(despawnedAt);
    }, []);

    return (
        <>
            {spawnPlan.map((spawn) => {
                const habitat = habitatById.get(spawn.habitatId);
                if (!habitat) {
                    return null;
                }
                return (
                    <Squirrel
                        habitat={habitat}
                        key={`${habitat.id}:${habitat.revisionKey}:${spawn.spawnSequence.toString()}`}
                        onDespawn={handleDespawn}
                        spawnSequence={spawn.spawnSequence}
                    />
                );
            })}
        </>
    );
}
