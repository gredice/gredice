import type { BlockData } from '@gredice/client';
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Material, Object3D } from 'three';
import {
    DoubleSide,
    MathUtils,
    type Mesh,
    MeshStandardMaterial,
    Vector3,
} from 'three';
import { useGameFlags } from '../../GameFlagsContext';
import { useBlockData } from '../../hooks/useBlockData';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
    type AnimalDisturbance,
    type GameState,
    useGameState,
    useGameStateStore,
} from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import { AnimalTargetDebugMarker } from '../animals/AnimalDebugIndicators';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import { isFreshGardenAvatarPresence } from '../animals/animalAvatarFollowing';
import {
    type AnimalFlightObstacle,
    createAnimalFlightObstacles,
    createObstacleSafeFlightWaypoints,
    isAnimalFlightPositionSafe,
    isAnimalFlightSegmentClear,
} from '../animals/animalFlightSafety';
import {
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
} from '../animals/animalMovementTerrain';
import { getBeeHabitatGroups } from '../bees/beeBehavior';
import {
    computePollinatorHabitatCenter,
    createAllPollinatorFlowerTargets,
    type PollinatorFlowerTarget,
    type PollinatorGarden,
} from '../pollinators/flowerTargets';
import {
    type ButterflySpawnDescriptor,
    type ButterflyWeather,
    canSpawnButterfly,
    createButterflyFlowerOrbitOffset,
    createButterflySpawnDescriptor,
    createSeededButterflyRandom,
    getButterflyAvatarAvoidanceOffset,
    getButterflyLifecycleDecision,
    getButterflyRestSeconds,
    getButterflyWingVariant,
    hashButterflySeed,
    isButterflyActive,
    shouldButterflyApproachFlower,
} from './butterflyBehavior';

type ButterflyWeatherOverride = Partial<NonNullable<GameState['weather']>>;

export type ButterflyHabitat = {
    center: Vector3;
    id: string;
    seed: number;
    targets: PollinatorFlowerTarget[];
};

type ButterflySpawn = {
    descriptor: ButterflySpawnDescriptor;
    habitat: ButterflyHabitat;
};

type ButterflyFlightPhase =
    | 'approaching'
    | 'departing'
    | 'meandering'
    | 'taking-off';

type ButterflyFlightState = {
    duration: number;
    from: Vector3;
    pathIndex: number;
    phase: ButterflyFlightPhase;
    startedAt: number;
    target: PollinatorFlowerTarget | null;
    to: Vector3;
    waypoints: Vector3[];
};

type ButterflyLandingState = {
    duration: number;
    from: Vector3;
    phase: 'landing';
    startedAt: number;
    target: PollinatorFlowerTarget;
    to: Vector3;
};

type ButterflyRestingState = {
    phase: 'resting';
    restUntil: number;
    startedAt: number;
    target: PollinatorFlowerTarget;
};

type ButterflyRuntimeState =
    | ButterflyFlightState
    | ButterflyLandingState
    | ButterflyRestingState;

type ButterflyRigNode = {
    basePositionY: number;
    baseRotationX: number;
    baseRotationY: number;
    baseRotationZ: number;
    object: Object3D | null;
};

type ButterflyRig = {
    body: ButterflyRigNode;
    head: ButterflyRigNode;
    wingLeft: ButterflyRigNode;
    wingRight: ButterflyRigNode;
};

const clearButterflyWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
} satisfies ButterflyWeather;

const butterflyDebugBehaviors = [
    'meandering',
    'approaching',
    'landing',
    'resting',
    'taking-off',
    'departing',
];
// The remodeled GLB has a 1.98-unit maximum silhouette versus the legacy
// model's 1.72 units. This compensating scale keeps the rendered maximum span
// at 0.21328 world units: exactly 40% of the legacy 0.5332-unit silhouette.
export const butterflyActorScale = 0.10771717247127598;
const butterflyFlightSpeed = 0.78;
const butterflyApproachHeight = 0.42;
const butterflyLandingLift = 0.035;
const butterflyTurnDamping = 5.8;
const butterflyStateTickSeconds = 0.45;
const animalDisturbanceReactionWindowMs = 2500;
const fullTurn = Math.PI * 2;

function horizontalDistance(
    left: Pick<Vector3, 'x' | 'z'>,
    right: Pick<Vector3, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function chooseCandidate<T>(candidates: readonly T[], random: () => number) {
    if (candidates.length <= 0) {
        return null;
    }
    return candidates[Math.floor(random() * candidates.length)] ?? null;
}

export function createButterflyHabitats({
    blockData,
    garden,
    groundDecorationDensity,
}: {
    blockData: BlockData[] | null | undefined;
    garden: PollinatorGarden | null | undefined;
    groundDecorationDensity: number;
}) {
    if (!garden) {
        return [];
    }

    const movementSurfaces = createAnimalMovementSurfaces({
        blockData,
        groundLift: 0.02,
        stacks: garden.stacks,
        swimDepth: 0.1,
    });
    const obstacles = createAnimalFlightObstacles({
        blockData,
        stacks: garden.stacks,
    });
    const targetStackByBlockId = new Map<string, Stack>();
    for (const stack of garden.stacks) {
        for (const block of stack.blocks) {
            targetStackByBlockId.set(block.id, stack);
        }
    }

    const targets = createAllPollinatorFlowerTargets({
        blockData,
        garden,
        groundDecorationDensity,
    }).filter((target) => {
        const hostStack = target.blockIds
            ?.map((blockId) => targetStackByBlockId.get(blockId))
            .find((stack) => stack !== undefined);
        if (!hostStack) {
            return false;
        }

        const support = getAnimalMovementSurfaceAt(
            hostStack.position,
            movementSurfaces,
        );
        if (support?.kind !== 'ground') {
            return false;
        }

        return isAnimalFlightPositionSafe({
            ignoredBlockIds: new Set(target.blockIds),
            obstacles,
            position: target.position,
        });
    });

    return getBeeHabitatGroups(targets)
        .map((group, index) => {
            const firstTarget = group[0];
            if (!firstTarget) {
                return null;
            }
            const habitatGeometry = group
                .map(
                    (target) =>
                        `${target.id}:${target.position.x}:${target.position.y}:${target.position.z}`,
                )
                .sort()
                .join('|');
            const id = `butterfly-habitat-${index + 1}-${hashButterflySeed(habitatGeometry)}`;
            return {
                center: computePollinatorHabitatCenter(group),
                id,
                seed: hashButterflySeed(
                    `${garden.id ?? 'garden'}:${id}:${firstTarget.id}:${group.length}`,
                ),
                targets: group,
            } satisfies ButterflyHabitat;
        })
        .filter((habitat) => habitat !== null);
}

function flightDuration(from: Vector3, to: Vector3) {
    return MathUtils.clamp(
        from.distanceTo(to) / butterflyFlightSpeed,
        0.55,
        4.4,
    );
}

function smoothProgress(progress: number) {
    const clamped = MathUtils.clamp(progress, 0, 1);
    return clamped * clamped * (3 - 2 * clamped);
}

function makeFlightState({
    from,
    ignoredBlockIds,
    now,
    obstacles,
    phase,
    target,
    to,
}: {
    from: Vector3;
    ignoredBlockIds?: ReadonlySet<string>;
    now: number;
    obstacles: readonly AnimalFlightObstacle[];
    phase: ButterflyFlightPhase;
    target: PollinatorFlowerTarget | null;
    to: Vector3;
}) {
    const waypoints = createObstacleSafeFlightWaypoints({
        from,
        ignoredBlockIds,
        obstacles,
        to,
    });
    const firstWaypoint = waypoints[0];
    if (!firstWaypoint) {
        return null;
    }

    return {
        duration: flightDuration(from, firstWaypoint),
        from: from.clone(),
        pathIndex: 0,
        phase,
        startedAt: now,
        target,
        to: firstWaypoint.clone(),
        waypoints,
    } satisfies ButterflyFlightState;
}

function advanceFlightPath(
    runtime: ButterflyFlightState,
    position: Vector3,
    now: number,
) {
    const nextIndex = runtime.pathIndex + 1;
    const nextWaypoint = runtime.waypoints[nextIndex];
    if (!nextWaypoint) {
        return false;
    }

    runtime.from.copy(position);
    runtime.to.copy(nextWaypoint);
    runtime.pathIndex = nextIndex;
    runtime.startedAt = now;
    runtime.duration = flightDuration(runtime.from, runtime.to);
    return true;
}

function findSafeMeanderTarget({
    anchor,
    habitat,
    obstacles,
    random,
}: {
    anchor?: PollinatorFlowerTarget | null;
    habitat: ButterflyHabitat;
    obstacles: readonly AnimalFlightObstacle[];
    random: () => number;
}) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const selectedAnchor =
            anchor ?? chooseCandidate(habitat.targets, random);
        if (!selectedAnchor) {
            return null;
        }
        const offset = createButterflyFlowerOrbitOffset(random);
        const ignoredBlockIds = new Set(selectedAnchor.blockIds ?? []);
        const candidate = new Vector3(
            selectedAnchor.position.x + offset.x,
            selectedAnchor.position.y + offset.y,
            selectedAnchor.position.z + offset.z,
        );
        if (
            isAnimalFlightPositionSafe({
                ignoredBlockIds,
                obstacles,
                position: candidate,
            })
        ) {
            return { ignoredBlockIds, position: candidate };
        }
    }

    const fallbackAnchor = anchor ?? habitat.targets[0];
    if (!fallbackAnchor) {
        return null;
    }
    const obstacleTop = obstacles.reduce(
        (top, obstacle) => Math.max(top, obstacle.topY),
        fallbackAnchor.position.y,
    );
    const fallback = fallbackAnchor.position.clone();
    fallback.y = obstacleTop + 0.75;
    const ignoredBlockIds = new Set(fallbackAnchor.blockIds ?? []);
    return isAnimalFlightPositionSafe({
        ignoredBlockIds,
        obstacles,
        position: fallback,
    })
        ? { ignoredBlockIds, position: fallback }
        : null;
}

export function createMeanderState({
    anchor,
    from,
    habitat,
    now,
    obstacles,
    random,
}: {
    anchor?: PollinatorFlowerTarget | null;
    from: Vector3;
    habitat: ButterflyHabitat;
    now: number;
    obstacles: readonly AnimalFlightObstacle[];
    random: () => number;
}) {
    const target = findSafeMeanderTarget({
        anchor,
        habitat,
        obstacles,
        random,
    });
    return target
        ? makeFlightState({
              from,
              ignoredBlockIds: target.ignoredBlockIds,
              now,
              obstacles,
              phase: 'meandering',
              target: null,
              to: target.position,
          })
        : null;
}

export function createApproachState({
    from,
    now,
    obstacles,
    target,
}: {
    from: Vector3;
    now: number;
    obstacles: readonly AnimalFlightObstacle[];
    target: PollinatorFlowerTarget;
}) {
    return makeFlightState({
        from,
        ignoredBlockIds: new Set(target.blockIds ?? []),
        now,
        obstacles,
        phase: 'approaching',
        target,
        to: target.position
            .clone()
            .add(new Vector3(0, butterflyApproachHeight, 0)),
    });
}

export function createTakeoffState({
    from,
    now,
    obstacles,
    target,
}: {
    from: Vector3;
    now: number;
    obstacles: readonly AnimalFlightObstacle[];
    target: PollinatorFlowerTarget | null;
}) {
    return makeFlightState({
        from,
        ignoredBlockIds: new Set(target?.blockIds ?? []),
        now,
        obstacles,
        phase: 'taking-off',
        target,
        to: from.clone().add(new Vector3(0, 0.58, 0)),
    });
}

function createDepartureState({
    from,
    habitat,
    now,
    obstacles,
    random,
    target,
}: {
    from: Vector3;
    habitat: ButterflyHabitat;
    now: number;
    obstacles: readonly AnimalFlightObstacle[];
    random: () => number;
    target: PollinatorFlowerTarget | null;
}) {
    const angle = random() * fullTurn;
    const to = new Vector3(
        habitat.center.x + Math.cos(angle) * 5.5,
        Math.max(habitat.center.y + 3.2, from.y + 2.4),
        habitat.center.z + Math.sin(angle) * 5.5,
    );
    return makeFlightState({
        from,
        ignoredBlockIds: new Set(target?.blockIds ?? []),
        now,
        obstacles,
        phase: 'departing',
        target,
        to,
    });
}

function createLandingState({
    from,
    now,
    obstacles,
    target,
}: {
    from: Vector3;
    now: number;
    obstacles: readonly AnimalFlightObstacle[];
    target: PollinatorFlowerTarget;
}) {
    const to = target.position
        .clone()
        .add(new Vector3(0, butterflyLandingLift, 0));
    const ignoredBlockIds = new Set(target.blockIds ?? []);
    if (
        !isAnimalFlightSegmentClear({
            from,
            ignoredBlockIds,
            obstacles,
            to,
        })
    ) {
        return null;
    }

    return {
        duration: 0.68,
        from: from.clone(),
        phase: 'landing',
        startedAt: now,
        target,
        to,
    } satisfies ButterflyLandingState;
}

function distanceToDisturbance(
    position: Vector3,
    disturbance: AnimalDisturbance,
) {
    return Math.hypot(
        position.x - disturbance.position.x,
        position.y - disturbance.position.y,
        position.z - disturbance.position.z,
    );
}

function disturbanceAffectsButterfly(
    runtime: ButterflyRuntimeState,
    position: Vector3,
    disturbance: AnimalDisturbance,
) {
    return (
        distanceToDisturbance(position, disturbance) <= disturbance.radius ||
        ('target' in runtime &&
            runtime.target !== null &&
            (runtime.target.blockIds?.includes(disturbance.sourceBlockId) ??
                false))
    );
}

function cloneButterflyMaterial(
    material: Material,
    objectName: string,
    variant: ReturnType<typeof getButterflyWingVariant>,
) {
    const clone = material.clone();
    if (!(clone instanceof MeshStandardMaterial)) {
        return clone;
    }

    clone.metalness = 0;
    clone.roughness = objectName.includes('Wing') ? 0.68 : 0.78;
    if (objectName.includes('WingFore')) {
        clone.color.set(variant.primary);
    } else if (objectName.includes('WingHind')) {
        clone.color.set(variant.secondary);
    } else if (objectName.includes('WingEdge')) {
        clone.color.set(variant.edge);
    } else if (
        objectName.includes('WingBand') ||
        objectName.includes('WingSpot')
    ) {
        clone.color.set(variant.spot);
    }
    if (objectName.includes('Wing')) {
        clone.side = DoubleSide;
    }
    return clone;
}

function prepareButterflyMesh(
    object: Mesh,
    variant: ReturnType<typeof getButterflyWingVariant>,
) {
    if (object.name.includes('WingBand')) {
        object.visible = variant.bandVisible;
    } else if (object.name.includes('WingSpotOuter')) {
        object.visible = variant.outerSpotsVisible;
    } else if (object.name.includes('WingSpotInner')) {
        object.visible = variant.innerSpotsVisible;
    }
    object.receiveShadow = !object.name.includes('Wing');
    object.material = Array.isArray(object.material)
        ? object.material.map((material) =>
              cloneButterflyMaterial(material, object.name, variant),
          )
        : cloneButterflyMaterial(object.material, object.name, variant);
}

function getRigNode(scene: Object3D, name: string): ButterflyRigNode {
    const object = scene.getObjectByName(name) ?? null;
    return {
        basePositionY: object?.position.y ?? 0,
        baseRotationX: object?.rotation.x ?? 0,
        baseRotationY: object?.rotation.y ?? 0,
        baseRotationZ: object?.rotation.z ?? 0,
        object,
    };
}

function updateButterflyRig({
    delta,
    descriptor,
    now,
    rig,
    runtime,
}: {
    delta: number;
    descriptor: ButterflySpawnDescriptor;
    now: number;
    rig: ButterflyRig;
    runtime: ButterflyRuntimeState;
}) {
    const resting = runtime.phase === 'resting';
    const landing = runtime.phase === 'landing';
    const slowWingMotion = Math.sin(now * 0.75 + descriptor.seed) * 0.045;
    const flap =
        Math.sin(
            now * descriptor.flapRate * fullTurn + descriptor.seed * 0.01,
        ) * descriptor.flapAmplitude;
    const wingAmount = resting
        ? 1.2 + slowWingMotion
        : landing
          ? flap * 0.42 + 0.36
          : flap;

    if (rig.wingLeft.object) {
        rig.wingLeft.object.rotation.y = MathUtils.damp(
            rig.wingLeft.object.rotation.y,
            rig.wingLeft.baseRotationY + wingAmount,
            resting ? 3.5 : 18,
            delta,
        );
    }
    if (rig.wingRight.object) {
        rig.wingRight.object.rotation.y = MathUtils.damp(
            rig.wingRight.object.rotation.y,
            rig.wingRight.baseRotationY - wingAmount,
            resting ? 3.5 : 18,
            delta,
        );
    }
    if (rig.body.object) {
        rig.body.object.position.y = MathUtils.damp(
            rig.body.object.position.y,
            rig.body.basePositionY +
                (resting ? 0 : Math.sin(now * 3.8 + descriptor.seed) * 0.018),
            9,
            delta,
        );
        rig.body.object.rotation.x = MathUtils.damp(
            rig.body.object.rotation.x,
            rig.body.baseRotationX + (resting ? 0.12 : -0.04),
            7,
            delta,
        );
    }
    if (rig.head.object) {
        rig.head.object.rotation.x = MathUtils.damp(
            rig.head.object.rotation.x,
            rig.head.baseRotationX +
                (resting ? Math.sin(now * 0.9 + descriptor.seed) * 0.08 : 0),
            5,
            delta,
        );
    }
}

function createButterflyDebugEntry({
    descriptor,
    group,
    now,
    runtime,
}: {
    descriptor: ButterflySpawnDescriptor;
    group: Group;
    now: number;
    runtime: ButterflyRuntimeState;
}): AnimalDebugEntry {
    const target = 'target' in runtime ? runtime.target : null;
    return {
        activity: `${getButterflyWingVariant(descriptor.variantId).label} · spawn ${descriptor.spawnSequence}`,
        behavior: runtime.phase,
        debugBehaviors: butterflyDebugBehaviors,
        id: descriptor.id,
        label: descriptor.id,
        phase: runtime.phase,
        position: {
            x: Math.round(group.position.x * 100) / 100,
            y: Math.round(group.position.y * 100) / 100,
            z: Math.round(group.position.z * 100) / 100,
        },
        species: 'Butterfly',
        targetId: target?.id ?? 'air',
        updatedAt: now,
    };
}

function Butterfly({
    activeConditions,
    descriptor,
    habitat,
    habitatAvailable,
    obstacles,
    onDespawn,
}: {
    activeConditions: boolean;
    descriptor: ButterflySpawnDescriptor;
    habitat: ButterflyHabitat;
    habitatAvailable: boolean;
    obstacles: readonly AnimalFlightObstacle[];
    onDespawn: (id: string) => void;
}) {
    const gltf = useGameGLTF('Butterfly');
    const { enableDebugHudFlag = false } = useGameFlags();
    const gameStateStore = useGameStateStore();
    const groupRef = useRef<Group>(null);
    const targetDebugRef = useRef<Group>(null);
    const runtimeRef = useRef<ButterflyRuntimeState | null>(null);
    const randomRef = useRef(createSeededButterflyRandom(descriptor.seed));
    const unsuitableSinceRef = useRef<number | null>(null);
    const lastDisturbanceSequenceRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const lastDebugUpdateRef = useRef(0);
    const desiredPositionRef = useRef(new Vector3());
    const avoidedPositionRef = useRef(new Vector3());
    const flightDirectionRef = useRef(new Vector3());
    const animalTargetsDebugVisible = useGameState(
        (state) => state.animalTargetsDebugVisible,
    );
    const animalDebugCommand = useGameState(
        (state) => state.animalDebugCommand,
    );
    const animalDisturbance = useGameState((state) => state.animalDisturbance);
    const setAnimalDebugEntry = useGameState(
        (state) => state.setAnimalDebugEntry,
    );
    const removeAnimalDebugEntry = useGameState(
        (state) => state.removeAnimalDebugEntry,
    );
    const variant = getButterflyWingVariant(descriptor.variantId);

    const butterflyModel = useMemo(() => {
        const clone = gltf.scene.clone(true);
        const { primaryCasterCount } = configureActorMeshShadows(
            clone,
            (object) => prepareButterflyMesh(object, variant),
        );
        return {
            primaryCasterCount,
            rig: {
                body: getRigNode(clone, 'Butterfly_BodyPivot'),
                head: getRigNode(clone, 'Butterfly_HeadPivot'),
                wingLeft: getRigNode(clone, 'Butterfly_WingPivot_L'),
                wingRight: getRigNode(clone, 'Butterfly_WingPivot_R'),
            } satisfies ButterflyRig,
            scene: clone,
        };
    }, [gltf.scene, variant]);
    const updateGroundingShadow = useActorGroundingShadow({
        id: `butterfly:${descriptor.id}`,
        primaryCasterCount: butterflyModel.primaryCasterCount,
        species: 'butterfly',
    });

    useEffect(() => {
        return () => removeAnimalDebugEntry(descriptor.id);
    }, [descriptor.id, removeAnimalDebugEntry]);

    useEffect(() => {
        if (!enableDebugHudFlag) {
            removeAnimalDebugEntry(descriptor.id);
        }
    }, [descriptor.id, enableDebugHudFlag, removeAnimalDebugEntry]);

    useEffect(() => {
        if (!animalTargetsDebugVisible && targetDebugRef.current) {
            targetDebugRef.current.visible = false;
        }
    }, [animalTargetsDebugVisible]);

    useFrame(({ clock: frameClock }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }
        const now = frameClock.getElapsedTime();
        const random = randomRef.current;
        let runtime = runtimeRef.current;

        if (!runtime) {
            const target =
                habitat.targets[descriptor.startTargetIndex] ??
                habitat.targets[0];
            if (!target) {
                onDespawn(descriptor.id);
                return;
            }
            const angle = random() * fullTurn;
            group.position
                .copy(target.position)
                .add(
                    new Vector3(
                        Math.cos(angle) * (0.35 + random() * 0.25),
                        0.55 + random() * 0.35,
                        Math.sin(angle) * (0.35 + random() * 0.25),
                    ),
                );
            runtime =
                createMeanderState({
                    anchor: target,
                    from: group.position,
                    habitat,
                    now,
                    obstacles,
                    random,
                }) ??
                createApproachState({
                    from: group.position,
                    now,
                    obstacles,
                    target,
                });
            if (!runtime) {
                onDespawn(descriptor.id);
                return;
            }
            runtimeRef.current = runtime;
        }

        if (activeConditions) {
            unsuitableSinceRef.current = null;
        } else if (unsuitableSinceRef.current === null) {
            unsuitableSinceRef.current = now;
        }

        const lifecycle = getButterflyLifecycleDecision({
            expiresAt: descriptor.expiresAt,
            habitatAvailable,
            now,
            unsuitableSince: unsuitableSinceRef.current,
        });
        if (lifecycle === 'despawn') {
            onDespawn(descriptor.id);
            return;
        }
        if (lifecycle === 'depart' && runtime.phase !== 'departing') {
            const departure = createDepartureState({
                from: group.position,
                habitat,
                now,
                obstacles,
                random,
                target: runtime.target,
            });
            if (!departure) {
                onDespawn(descriptor.id);
                return;
            }
            runtime = departure;
            runtimeRef.current = runtime;
        }

        if (
            animalDebugCommand &&
            animalDebugCommand.sequence !==
                lastDebugCommandSequenceRef.current &&
            animalDebugCommand.species === 'Butterfly'
        ) {
            lastDebugCommandSequenceRef.current = animalDebugCommand.sequence;
            if (
                !animalDebugCommand.targetId ||
                animalDebugCommand.targetId === descriptor.id
            ) {
                const target = chooseCandidate(habitat.targets, random);
                const forced =
                    animalDebugCommand.behavior === 'departing'
                        ? createDepartureState({
                              from: group.position,
                              habitat,
                              now,
                              obstacles,
                              random,
                              target: runtime.target,
                          })
                        : animalDebugCommand.behavior === 'taking-off'
                          ? createTakeoffState({
                                from: group.position,
                                now,
                                obstacles,
                                target: runtime.target ?? target,
                            })
                          : animalDebugCommand.behavior === 'landing' && target
                            ? createLandingState({
                                  from: group.position,
                                  now,
                                  obstacles,
                                  target,
                              })
                            : animalDebugCommand.behavior === 'resting' &&
                                target
                              ? {
                                    phase: 'resting' as const,
                                    restUntil:
                                        now + getButterflyRestSeconds(random),
                                    startedAt: now,
                                    target,
                                }
                              : animalDebugCommand.behavior === 'approaching' &&
                                  target
                                ? createApproachState({
                                      from: group.position,
                                      now,
                                      obstacles,
                                      target,
                                  })
                                : createMeanderState({
                                      anchor: runtime.target ?? target,
                                      from: group.position,
                                      habitat,
                                      now,
                                      obstacles,
                                      random,
                                  });
                if (forced) {
                    runtime = forced;
                    runtimeRef.current = runtime;
                }
            }
        }

        if (
            animalDisturbance &&
            animalDisturbance.sequence !== lastDisturbanceSequenceRef.current
        ) {
            lastDisturbanceSequenceRef.current = animalDisturbance.sequence;
            if (
                Date.now() - animalDisturbance.createdAt <=
                    animalDisturbanceReactionWindowMs &&
                disturbanceAffectsButterfly(
                    runtime,
                    group.position,
                    animalDisturbance,
                )
            ) {
                const takeoff = createTakeoffState({
                    from: group.position,
                    now,
                    obstacles,
                    target: runtime.target,
                });
                if (takeoff) {
                    runtime = takeoff;
                    runtimeRef.current = runtime;
                }
            }
        }

        const avatarPresence = gameStateStore.getState().gardenAvatarPresence;
        const freshAvatar = isFreshGardenAvatarPresence(avatarPresence, now)
            ? avatarPresence
            : null;
        if (
            freshAvatar &&
            horizontalDistance(group.position, freshAvatar.position) < 0.68 &&
            runtime.phase === 'resting'
        ) {
            const takeoff = createTakeoffState({
                from: group.position,
                now,
                obstacles,
                target: runtime.target,
            });
            if (takeoff) {
                runtime = takeoff;
                runtimeRef.current = runtime;
            }
        }

        if (runtime.phase === 'resting') {
            group.position.copy(runtime.target.position).y +=
                butterflyLandingLift;
            group.rotation.z = MathUtils.damp(group.rotation.z, 0, 8, delta);
            if (now >= runtime.restUntil) {
                const takeoff = createTakeoffState({
                    from: group.position,
                    now,
                    obstacles,
                    target: runtime.target,
                });
                if (takeoff) {
                    runtime = takeoff;
                    runtimeRef.current = runtime;
                }
            }
        } else if (runtime.phase === 'landing') {
            const progress = (now - runtime.startedAt) / runtime.duration;
            group.position
                .copy(runtime.from)
                .lerp(runtime.to, smoothProgress(progress));
            group.rotation.z = MathUtils.damp(group.rotation.z, 0, 7, delta);
            if (progress >= 1) {
                runtime = {
                    phase: 'resting',
                    restUntil: now + getButterflyRestSeconds(random),
                    startedAt: now,
                    target: runtime.target,
                };
                runtimeRef.current = runtime;
            }
        } else {
            const progress = (now - runtime.startedAt) / runtime.duration;
            const eased = smoothProgress(progress);
            const desiredPosition = desiredPositionRef.current
                .copy(runtime.from)
                .lerp(runtime.to, eased);
            const arc =
                runtime.phase === 'approaching'
                    ? 0.08
                    : runtime.phase === 'taking-off'
                      ? 0.12
                      : 0.18;
            desiredPosition.y += Math.sin(Math.PI * eased) * arc;

            const avoidance = getButterflyAvatarAvoidanceOffset({
                avatarPosition: freshAvatar?.position ?? null,
                butterflyPosition: desiredPosition,
            });
            const hasAvoidance =
                avoidance.x !== 0 || avoidance.y !== 0 || avoidance.z !== 0;
            const avoidedPosition = avoidedPositionRef.current.set(
                desiredPosition.x + avoidance.x,
                desiredPosition.y + avoidance.y,
                desiredPosition.z + avoidance.z,
            );
            const useAvoidedPosition =
                hasAvoidance &&
                isAnimalFlightPositionSafe({
                    obstacles,
                    position: avoidedPosition,
                }) &&
                isAnimalFlightSegmentClear({
                    from: group.position,
                    obstacles,
                    to: avoidedPosition,
                });
            group.position.copy(
                useAvoidedPosition ? avoidedPosition : desiredPosition,
            );

            const direction = flightDirectionRef.current
                .copy(runtime.to)
                .sub(runtime.from);
            if (direction.lengthSq() > 0.0001) {
                const targetYaw = Math.atan2(direction.x, direction.z);
                const yawDelta =
                    MathUtils.euclideanModulo(
                        targetYaw - group.rotation.y + Math.PI,
                        fullTurn,
                    ) - Math.PI;
                group.rotation.y +=
                    yawDelta * Math.min(1, delta * butterflyTurnDamping);
                group.rotation.z = MathUtils.damp(
                    group.rotation.z,
                    MathUtils.clamp(-yawDelta * 0.34, -0.42, 0.42),
                    6,
                    delta,
                );
            }

            if (progress >= 1) {
                if (advanceFlightPath(runtime, group.position, now)) {
                    runtimeRef.current = runtime;
                } else if (runtime.phase === 'departing') {
                    onDespawn(descriptor.id);
                    return;
                } else if (runtime.phase === 'approaching' && runtime.target) {
                    runtime =
                        createLandingState({
                            from: group.position,
                            now,
                            obstacles,
                            target: runtime.target,
                        }) ??
                        createTakeoffState({
                            from: group.position,
                            now,
                            obstacles,
                            target: runtime.target,
                        }) ??
                        runtime;
                    runtimeRef.current = runtime;
                } else {
                    const nextTarget = chooseCandidate(habitat.targets, random);
                    const nextRuntime =
                        nextTarget && shouldButterflyApproachFlower(random)
                            ? createApproachState({
                                  from: group.position,
                                  now,
                                  obstacles,
                                  target: nextTarget,
                              })
                            : createMeanderState({
                                  anchor: runtime.target,
                                  from: group.position,
                                  habitat,
                                  now,
                                  obstacles,
                                  random,
                              });
                    if (nextRuntime) {
                        runtime = nextRuntime;
                        runtimeRef.current = runtime;
                    }
                }
            }
        }

        updateButterflyRig({
            delta,
            descriptor,
            now,
            rig: butterflyModel.rig,
            runtime,
        });

        const emergenceProgress = MathUtils.clamp(
            (now - descriptor.bornAt) / 0.55,
            0,
            1,
        );
        const departingScale =
            runtime.phase === 'departing'
                ? MathUtils.clamp(
                      1 -
                          (now - runtime.startedAt) /
                              Math.max(runtime.duration * 1.4, 1),
                      0.15,
                      1,
                  )
                : 1;
        group.scale.setScalar(
            butterflyActorScale * emergenceProgress * departingScale,
        );

        const debugTarget = targetDebugRef.current;
        if (debugTarget) {
            const target = 'target' in runtime ? runtime.target : null;
            debugTarget.visible = animalTargetsDebugVisible && target !== null;
            if (debugTarget.visible && target) {
                debugTarget.position.copy(target.position);
            }
        }

        if (updateGroundingShadow) {
            updateGroundingShadow({
                actorY: group.position.y,
                receiverY:
                    runtime.phase === 'resting' ? runtime.target.position.y : 0,
                visible: runtime.phase === 'resting',
                x: group.position.x,
                yaw: group.rotation.y,
                z: group.position.z,
            });
        }

        if (enableDebugHudFlag && now - lastDebugUpdateRef.current >= 0.2) {
            lastDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createButterflyDebugEntry({
                    descriptor,
                    group,
                    now,
                    runtime,
                }),
            );
        }
    });

    return (
        <>
            <group ref={groupRef} scale={0}>
                <primitive object={butterflyModel.scene} />
            </group>
            <AnimalTargetDebugMarker ref={targetDebugRef} color="#8b5cf6" />
        </>
    );
}

function resolveButterflyWeather({
    gameWeather,
    weatherDisabled,
    weatherNow,
    weatherOverride,
}: {
    gameWeather: GameState['weather'];
    weatherDisabled: boolean;
    weatherNow: ButterflyWeather | null | undefined;
    weatherOverride: ButterflyWeatherOverride | undefined;
}) {
    if (weatherDisabled) {
        return clearButterflyWeather;
    }
    if (weatherOverride) {
        return { ...clearButterflyWeather, ...weatherOverride };
    }
    if (!weatherNow && !gameWeather) {
        return undefined;
    }
    return { ...clearButterflyWeather, ...weatherNow, ...gameWeather };
}

export function Butterflies({
    farmId,
    garden,
    groundDecorationDensity = 1,
    weather,
    weatherDisabled = false,
}: {
    farmId?: number | null;
    garden: PollinatorGarden | null | undefined;
    groundDecorationDensity?: number;
    weather?: ButterflyWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const { data: blockData } = useBlockData();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const gameWeather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow(
        !weatherDisabled && !weather,
        farmId,
    );
    const resolvedWeather = resolveButterflyWeather({
        gameWeather,
        weatherDisabled,
        weatherNow,
        weatherOverride: weather,
    });
    const activeConditions = isButterflyActive(timeOfDay, resolvedWeather);
    const habitats = useMemo(
        () =>
            createButterflyHabitats({
                blockData,
                garden,
                groundDecorationDensity,
            }),
        [blockData, garden, groundDecorationDensity],
    );
    const habitatIds = useMemo(
        () => new Set(habitats.map((habitat) => habitat.id)),
        [habitats],
    );
    const obstacles = useMemo(
        () =>
            createAnimalFlightObstacles({
                blockData,
                stacks: garden?.stacks,
            }),
        [blockData, garden?.stacks],
    );
    const [spawns, setSpawns] = useState<ButterflySpawn[]>([]);
    const spawnsRef = useRef<ButterflySpawn[]>([]);
    const lastSpawnAtRef = useRef(new Map<string, number>());
    const sequenceRef = useRef(new Map<string, number>());
    const lastPopulationTickRef = useRef(Number.NEGATIVE_INFINITY);
    useSceneTimeInvalidation(
        'fauna:butterflies',
        (activeConditions && habitats.length > 0) || spawns.length > 0,
        sceneFrameRates.ambient,
    );

    const commitSpawns = useCallback((nextSpawns: ButterflySpawn[]) => {
        spawnsRef.current = nextSpawns;
        setSpawns(nextSpawns);
    }, []);

    useFrame(({ clock }) => {
        const now = clock.getElapsedTime();
        if (now - lastPopulationTickRef.current < butterflyStateTickSeconds) {
            return;
        }
        lastPopulationTickRef.current = now;

        if (!activeConditions || habitats.length <= 0) {
            return;
        }

        const currentSpawns = spawnsRef.current;
        for (const habitat of habitats) {
            const lastSpawnAt = lastSpawnAtRef.current.get(habitat.id) ?? null;
            if (
                !canSpawnButterfly({
                    activeSpawns: currentSpawns.map(
                        (spawn) => spawn.descriptor,
                    ),
                    habitatId: habitat.id,
                    lastSpawnAt,
                    now,
                })
            ) {
                continue;
            }

            const spawnSequence =
                (sequenceRef.current.get(habitat.id) ?? 0) + 1;
            sequenceRef.current.set(habitat.id, spawnSequence);
            lastSpawnAtRef.current.set(habitat.id, now);
            commitSpawns([
                ...currentSpawns,
                {
                    descriptor: createButterflySpawnDescriptor({
                        bornAt: now,
                        gardenId: garden?.id,
                        habitatId: habitat.id,
                        spawnSequence,
                        targetCount: habitat.targets.length,
                    }),
                    habitat,
                },
            ]);
            break;
        }
    });

    const handleDespawn = useCallback(
        (id: string) => {
            const nextSpawns = spawnsRef.current.filter(
                (spawn) => spawn.descriptor.id !== id,
            );
            if (nextSpawns.length !== spawnsRef.current.length) {
                commitSpawns(nextSpawns);
            }
        },
        [commitSpawns],
    );

    return (
        <>
            {spawns.map(({ descriptor, habitat }) => (
                <Butterfly
                    key={descriptor.id}
                    activeConditions={activeConditions}
                    descriptor={descriptor}
                    habitat={habitat}
                    habitatAvailable={habitatIds.has(habitat.id)}
                    obstacles={obstacles}
                    onDespawn={handleDespawn}
                />
            ))}
        </>
    );
}
