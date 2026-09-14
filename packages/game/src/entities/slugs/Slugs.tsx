import type { BlockData } from '@gredice/client';
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Material, Object3D } from 'three';
import { MathUtils, type Mesh, Vector3 } from 'three';
import { useGameFlags } from '../../GameFlagsContext';
import { useBlockData } from '../../hooks/useBlockData';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import {
    sceneFrameRates,
    useSceneDeadline,
    useSceneFixedStepWork,
    useSceneRenderRequest,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
    type GameState,
    useGameState,
} from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import {
    chooseSlugBehavior,
    getSlugAnimationTargets,
    reconcileSlugPopulation,
    type SlugBehavior,
    type SlugPopulationEntry,
    type SlugPopulationState,
    slugActorScale,
    slugArrivalDurationMs,
    slugCreepSpeedBlocksPerSecond,
    slugDepartureDurationMs,
} from './slugBehavior';
import {
    createSlugHabitatCandidates,
    createSlugSpawnPlan,
    getSlugPostRainWetness,
    hashSlugSeed,
    quantizeSlugSurfaceWetness,
    type SlugHabitatCandidate,
    type SlugRainHistory,
    type SlugRaisedBed,
    type SlugWeather,
    slugPostRainWindowMs,
    updateSlugRainHistory,
} from './slugEcology';
import {
    findSlugPath,
    type SlugPathCell,
    type SlugPathResult,
} from './slugPathfinding';

type SlugWeatherOverride = Partial<NonNullable<GameState['weather']>>;

type SlugGarden = {
    id?: number | string;
    raisedBeds?: SlugRaisedBed[] | null;
    stacks: Stack[];
};

type SlugRigNode = {
    baseRotationX: number;
    baseRotationY: number;
    baseRotationZ: number;
    baseScaleX: number;
    baseScaleY: number;
    baseScaleZ: number;
    object: Object3D | null;
};

type SlugRig = {
    foot: SlugRigNode;
    head: SlugRigNode;
    lowerLeft: SlugRigNode;
    lowerRight: SlugRigNode;
    mantle: SlugRigNode;
    middle: SlugRigNode;
    rear: SlugRigNode;
    upperLeft: SlugRigNode;
    upperRight: SlugRigNode;
};

type SlugAnimationBlend = {
    bodyWave: number;
    feeding: number;
    feelers: number;
};

type MovingSlugState = {
    behavior: 'creep' | 'seek-damp';
    path: SlugPathCell[];
    pathfinding: SlugPathResult;
    phase: 'moving';
    target: SlugHabitatCandidate;
    waypointIndex: number;
};

type SettledSlugState = {
    behavior: 'feed' | 'pause';
    dwellUntil: number;
    pathfinding: SlugPathResult | null;
    phase: 'settled';
    target: SlugHabitatCandidate;
};

type SlugRuntimeState = MovingSlugState | SettledSlugState;

const clearSlugWeather = {
    rainy: 0,
    snowy: 0,
    temperature: null,
} satisfies SlugWeather;
const slugTurnDamping = 5.5;
const slugDecisionSeedStep = 0x9e3779b9;

function getSlugRigNode(root: Object3D, name: string): SlugRigNode {
    const object = root.getObjectByName(name) ?? null;
    return {
        baseRotationX: object?.rotation.x ?? 0,
        baseRotationY: object?.rotation.y ?? 0,
        baseRotationZ: object?.rotation.z ?? 0,
        baseScaleX: object?.scale.x ?? 1,
        baseScaleY: object?.scale.y ?? 1,
        baseScaleZ: object?.scale.z ?? 1,
        object,
    };
}

function cloneSlugMaterial(material: Material) {
    const clone = material.clone();
    clone.transparent = true;
    clone.depthWrite = true;
    return clone;
}

function prepareSlugMesh(mesh: Mesh, materials: Material[]) {
    if (Array.isArray(mesh.material)) {
        const clones = mesh.material.map(cloneSlugMaterial);
        mesh.material = clones;
        materials.push(...clones);
    } else {
        const clone = cloneSlugMaterial(mesh.material);
        mesh.material = clone;
        materials.push(clone);
    }
    mesh.receiveShadow = false;
}

function getLifecycleProgress(entry: SlugPopulationEntry, nowMs: number) {
    const duration =
        entry.lifecycle === 'departing'
            ? slugDepartureDurationMs
            : slugArrivalDurationMs;
    return MathUtils.clamp(
        (nowMs - entry.lifecycleStartedAtMs) / duration,
        0,
        1,
    );
}

function facePoint(group: Group, point: SlugPathCell, delta: number) {
    const dx = point.x - group.position.x;
    const dz = point.z - group.position.z;
    if (Math.hypot(dx, dz) <= 0.0001) {
        return;
    }
    group.rotation.y = MathUtils.damp(
        group.rotation.y,
        Math.atan2(dx, dz),
        slugTurnDamping,
        delta,
    );
}

function settledState(
    target: SlugHabitatCandidate,
    now: number,
    behavior: 'feed' | 'pause' = 'pause',
    dwellSeconds = 4,
    pathfinding: SlugPathResult | null = null,
): SettledSlugState {
    return {
        behavior,
        dwellUntil: now + dwellSeconds,
        pathfinding,
        phase: 'settled',
        target,
    };
}

function decideNextState({
    current,
    decisionSequence,
    habitat,
    now,
    seed,
}: {
    current: SlugHabitatCandidate;
    decisionSequence: number;
    habitat: SlugHabitatCandidate[];
    now: number;
    seed: number;
}): SlugRuntimeState {
    const decision = chooseSlugBehavior({
        current,
        habitat,
        seed: (seed + decisionSequence * slugDecisionSeedStep) >>> 0,
    });
    if (decision.behavior === 'feed' || decision.behavior === 'pause') {
        return settledState(
            decision.target,
            now,
            decision.behavior,
            decision.dwellSeconds,
        );
    }

    const pathfinding = findSlugPath({
        habitat,
        start: current,
        target: decision.target,
    });
    if (pathfinding.status !== 'path' || pathfinding.points.length < 2) {
        return settledState(current, now, 'pause', 5, pathfinding);
    }
    return {
        behavior: decision.behavior,
        path: pathfinding.points,
        pathfinding,
        phase: 'moving',
        target: decision.target,
        waypointIndex: 1,
    };
}

function closestHabitatCell(
    position: Pick<Vector3, 'x' | 'z'>,
    habitat: SlugHabitatCandidate[],
) {
    return habitat.reduce<SlugHabitatCandidate | null>((closest, candidate) => {
        if (!closest) {
            return candidate;
        }
        return Math.hypot(candidate.x - position.x, candidate.z - position.z) <
            Math.hypot(closest.x - position.x, closest.z - position.z)
            ? candidate
            : closest;
    }, null);
}

function createDebugState({
    behavior,
    current,
    habitat,
    now,
}: {
    behavior: string;
    current: SlugHabitatCandidate;
    habitat: SlugHabitatCandidate[];
    now: number;
}): SlugRuntimeState | null {
    if (behavior === 'pause' || behavior === 'feed') {
        return settledState(current, now, behavior, 120);
    }
    if (behavior !== 'creep' && behavior !== 'seek-damp') {
        return null;
    }
    const candidates = habitat
        .filter((candidate) => candidate.id !== current.id)
        .sort((left, right) =>
            behavior === 'seek-damp'
                ? right.moisture - left.moisture ||
                  left.id.localeCompare(right.id)
                : left.id.localeCompare(right.id),
        );
    for (const target of candidates) {
        const pathfinding = findSlugPath({
            habitat,
            start: current,
            target,
        });
        if (pathfinding.status === 'path' && pathfinding.points.length >= 2) {
            return {
                behavior,
                path: pathfinding.points,
                pathfinding,
                phase: 'moving',
                target,
                waypointIndex: 1,
            };
        }
    }
    return settledState(current, now, 'pause', 8);
}

function updateRig({
    blend,
    behavior,
    delta,
    now,
    rig,
    seed,
}: {
    behavior: SlugBehavior;
    blend: SlugAnimationBlend;
    delta: number;
    now: number;
    rig: SlugRig;
    seed: number;
}) {
    const targets = getSlugAnimationTargets({
        behavior,
        lifecycle: 'active',
        lifecycleProgress: 1,
    });
    blend.bodyWave = MathUtils.damp(
        blend.bodyWave,
        targets.bodyWave,
        3.8,
        delta,
    );
    blend.feeding = MathUtils.damp(blend.feeding, targets.feeding, 4.2, delta);
    blend.feelers = MathUtils.damp(blend.feelers, targets.feelers, 3.4, delta);

    const wave = now * 3.2 + seed * 0.0001;
    const bodyWave = Math.sin(wave) * 0.1 * blend.bodyWave;
    const bodyWaveTrailing = Math.sin(wave - 1.25) * 0.09 * blend.bodyWave;
    const glide = (Math.sin(wave * 1.35) + 1) * 0.035 * blend.bodyWave;
    const headDip = Math.sin(now * 2.1 + seed) * 0.09 * blend.feeding;

    if (rig.rear.object) {
        rig.rear.object.rotation.y = rig.rear.baseRotationY - bodyWaveTrailing;
        rig.rear.object.rotation.z = rig.rear.baseRotationZ + bodyWave * 0.45;
    }
    if (rig.middle.object) {
        rig.middle.object.rotation.y = rig.middle.baseRotationY + bodyWave;
        rig.middle.object.scale.set(
            rig.middle.baseScaleX * (1 - glide * 0.18),
            rig.middle.baseScaleY * (1 + glide),
            rig.middle.baseScaleZ,
        );
    }
    if (rig.mantle.object) {
        rig.mantle.object.rotation.y =
            rig.mantle.baseRotationY - bodyWave * 0.7;
        rig.mantle.object.rotation.z =
            rig.mantle.baseRotationZ - bodyWaveTrailing * 0.35;
    }
    if (rig.foot.object) {
        rig.foot.object.scale.set(
            rig.foot.baseScaleX * (1 + glide * 0.2),
            rig.foot.baseScaleY * (1 + glide * 0.8),
            rig.foot.baseScaleZ * (1 - glide * 0.22),
        );
    }
    if (rig.head.object) {
        rig.head.object.rotation.x = rig.head.baseRotationX + headDip;
        rig.head.object.rotation.y =
            rig.head.baseRotationY + bodyWaveTrailing * 0.34;
    }

    for (const [index, node] of [
        rig.upperLeft,
        rig.upperRight,
        rig.lowerLeft,
        rig.lowerRight,
    ].entries()) {
        if (!node.object) {
            continue;
        }
        const feelerWave =
            Math.sin(now * (1.35 + index * 0.13) + seed + index * 1.7) *
            0.16 *
            blend.feelers;
        node.object.rotation.x = node.baseRotationX + feelerWave * 0.48;
        node.object.rotation.z =
            node.baseRotationZ + feelerWave * (index % 2 === 0 ? -1 : 1);
    }
}

function createSlugDebugEntry({
    entry,
    group,
    now,
    runtime,
}: {
    entry: SlugPopulationEntry;
    group: Group;
    now: number;
    runtime: SlugRuntimeState;
}): AnimalDebugEntry {
    return {
        activity: runtime.phase,
        behavior: runtime.behavior,
        debugBehaviors: ['creep', 'seek-damp', 'pause', 'feed'],
        id: entry.spawn.id,
        label: 'Puž golać',
        pathfinding: runtime.pathfinding
            ? {
                  blockedCellCount: 0,
                  distance: runtime.pathfinding.distance,
                  nextWaypoint:
                      runtime.phase === 'moving'
                          ? runtime.path[runtime.waypointIndex]
                          : undefined,
                  status: runtime.pathfinding.status,
                  targetCell: {
                      x: runtime.target.x,
                      z: runtime.target.z,
                  },
                  visitedCellCount: runtime.pathfinding.visitedCellCount,
                  waypointCount: runtime.pathfinding.points.length,
              }
            : undefined,
        phase: entry.lifecycle,
        position: {
            x: group.position.x,
            y: group.position.y,
            z: group.position.z,
        },
        species: 'Slug',
        targetId: runtime.target.id,
        updatedAt: now,
    };
}

function SlugActor({
    entry,
    habitat,
}: {
    entry: SlugPopulationEntry;
    habitat: SlugHabitatCandidate[];
}) {
    const gltf = useGameGLTF('Slug');
    const { enableDebugHudFlag = false } = useGameFlags();
    const groupRef = useRef<Group>(null);
    const runtimeRef = useRef<SlugRuntimeState | null>(null);
    const decisionSequenceRef = useRef(0);
    const lastDebugUpdateRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const animationBlendRef = useRef<SlugAnimationBlend>({
        bodyWave: 0,
        feeding: 0,
        feelers: 0,
    });
    const setAnimalDebugEntry = useGameState(
        (state) => state.setAnimalDebugEntry,
    );
    const removeAnimalDebugEntry = useGameState(
        (state) => state.removeAnimalDebugEntry,
    );
    const animalDebugCommand = useGameState(
        (state) => state.animalDebugCommand,
    );
    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        const materials: Material[] = [];
        const { primaryCasterCount } = configureActorMeshShadows(
            scene,
            (mesh) => prepareSlugMesh(mesh, materials),
        );
        return {
            materials,
            primaryCasterCount,
            rig: {
                foot: getSlugRigNode(scene, 'Slug_FootPivot'),
                head: getSlugRigNode(scene, 'Slug_HeadPivot'),
                lowerLeft: getSlugRigNode(scene, 'Slug_LowerFeelerPivot_L'),
                lowerRight: getSlugRigNode(scene, 'Slug_LowerFeelerPivot_R'),
                mantle: getSlugRigNode(scene, 'Slug_MantlePivot'),
                middle: getSlugRigNode(scene, 'Slug_MiddlePivot'),
                rear: getSlugRigNode(scene, 'Slug_RearPivot'),
                upperLeft: getSlugRigNode(scene, 'Slug_UpperFeelerPivot_L'),
                upperRight: getSlugRigNode(scene, 'Slug_UpperFeelerPivot_R'),
            } satisfies SlugRig,
            scene,
        };
    }, [gltf.scene]);
    const updateGroundingShadow = useActorGroundingShadow({
        id: entry.spawn.id,
        primaryCasterCount: model.primaryCasterCount,
        species: 'slug',
    });

    useEffect(() => {
        const group = groupRef.current;
        if (!group || runtimeRef.current) {
            return;
        }
        group.position.set(
            entry.spawn.candidate.x,
            entry.spawn.candidate.y,
            entry.spawn.candidate.z,
        );
        group.rotation.y = (entry.spawn.seed / 4294967296) * Math.PI * 2;
        runtimeRef.current = settledState(entry.spawn.candidate, 0, 'pause', 2);
    }, [entry.spawn.candidate, entry.spawn.seed]);

    useEffect(() => {
        if (!enableDebugHudFlag) {
            removeAnimalDebugEntry(entry.spawn.id);
        }
        return () => removeAnimalDebugEntry(entry.spawn.id);
    }, [enableDebugHudFlag, entry.spawn.id, removeAnimalDebugEntry]);

    useEffect(
        () => () => {
            for (const material of model.materials) {
                material.dispose();
            }
        },
        [model.materials],
    );

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        let runtime = runtimeRef.current;
        if (!group || !runtime) {
            return;
        }
        const now = clock.elapsedTime;
        const nowMs = Date.now();
        const lifecycleProgress = getLifecycleProgress(entry, nowMs);
        const animationTargets = getSlugAnimationTargets({
            behavior: runtime.behavior,
            lifecycle: entry.lifecycle,
            lifecycleProgress,
        });
        const visibleScale =
            slugActorScale * (0.72 + animationTargets.visibility * 0.28);
        group.scale.setScalar(visibleScale);
        group.visible = animationTargets.visibility > 0.01;
        for (const material of model.materials) {
            material.opacity = animationTargets.visibility;
        }

        if (
            animalDebugCommand &&
            animalDebugCommand.sequence !==
                lastDebugCommandSequenceRef.current &&
            animalDebugCommand.species === 'Slug'
        ) {
            lastDebugCommandSequenceRef.current = animalDebugCommand.sequence;
            if (
                !animalDebugCommand.targetId ||
                animalDebugCommand.targetId === entry.spawn.id
            ) {
                const current = closestHabitatCell(group.position, habitat);
                const debugState = current
                    ? createDebugState({
                          behavior: animalDebugCommand.behavior,
                          current,
                          habitat,
                          now,
                      })
                    : null;
                if (debugState) {
                    runtime = debugState;
                    runtimeRef.current = runtime;
                }
            }
        }

        if (entry.lifecycle === 'active') {
            if (runtime.phase === 'moving') {
                const waypoint = runtime.path[runtime.waypointIndex];
                if (!waypoint) {
                    runtime = settledState(
                        runtime.target,
                        now,
                        runtime.target.suitablePlantNearby ? 'feed' : 'pause',
                        runtime.target.suitablePlantNearby ? 7 : 5,
                        runtime.pathfinding,
                    );
                    runtimeRef.current = runtime;
                } else {
                    const target = new Vector3(
                        waypoint.x,
                        waypoint.y,
                        waypoint.z,
                    );
                    facePoint(group, waypoint, delta);
                    const distance = group.position.distanceTo(target);
                    const step = slugCreepSpeedBlocksPerSecond * delta;
                    if (distance <= step + 0.001) {
                        group.position.copy(target);
                        runtime.waypointIndex += 1;
                    } else {
                        group.position.lerp(target, step / distance);
                    }
                }
            } else if (now >= runtime.dwellUntil) {
                decisionSequenceRef.current += 1;
                runtime = decideNextState({
                    current: runtime.target,
                    decisionSequence: decisionSequenceRef.current,
                    habitat,
                    now,
                    seed: entry.spawn.seed,
                });
                runtimeRef.current = runtime;
            }
        }

        updateRig({
            behavior: runtime.behavior,
            blend: animationBlendRef.current,
            delta,
            now,
            rig: model.rig,
            seed: entry.spawn.seed,
        });
        updateGroundingShadow?.({
            actorY: group.position.y,
            receiverY: group.position.y,
            visible: group.visible,
            x: group.position.x,
            yaw: group.rotation.y,
            z: group.position.z,
        });

        if (enableDebugHudFlag && now - lastDebugUpdateRef.current >= 0.5) {
            lastDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createSlugDebugEntry({ entry, group, now, runtime }),
            );
        }
    });

    return (
        <group
            ref={groupRef}
            name={`EnvironmentSlug:${entry.spawn.id}`}
            raycast={() => undefined}
        >
            <primitive object={model.scene} />
        </group>
    );
}

function resolveSlugWeather({
    gameWeather,
    weatherDisabled,
    weatherNow,
    weatherOverride,
}: {
    gameWeather: GameState['weather'];
    weatherDisabled: boolean;
    weatherNow: SlugWeather | null | undefined;
    weatherOverride: SlugWeatherOverride | undefined;
}) {
    if (weatherDisabled) {
        return clearSlugWeather;
    }
    return {
        ...clearSlugWeather,
        ...weatherNow,
        ...gameWeather,
        ...weatherOverride,
    };
}

const emptySlugPopulation: SlugPopulationState = {
    cooldownUntilById: {},
    entries: [],
};
const emptySlugRainHistory: SlugRainHistory = {
    lastRainEndedAtMs: null,
    qualifyingRainObserved: false,
    rainActive: false,
};

function slugPopulationStatesEqual(
    left: SlugPopulationState,
    right: SlugPopulationState,
) {
    const leftCooldowns = Object.entries(left.cooldownUntilById);
    const rightCooldowns = Object.entries(right.cooldownUntilById);
    return (
        leftCooldowns.length === rightCooldowns.length &&
        leftCooldowns.every(
            ([id, deadline]) => right.cooldownUntilById[id] === deadline,
        ) &&
        left.entries.length === right.entries.length &&
        left.entries.every((entry, index) => {
            const other = right.entries[index];
            return (
                other !== undefined &&
                entry.lifecycle === other.lifecycle &&
                entry.lifecycleStartedAtMs === other.lifecycleStartedAtMs &&
                entry.spawn === other.spawn
            );
        })
    );
}

export function Slugs({
    farmId,
    garden,
    spawnSeed,
    weather,
    weatherDisabled = false,
}: {
    farmId?: number | null;
    garden: SlugGarden | null | undefined;
    spawnSeed?: string | number;
    weather?: SlugWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const { data: blockData } = useBlockData() as {
        data: BlockData[] | undefined;
    };
    const gameWeather = useGameState((state) => state.weather);
    const recentWetness = useGameState((state) => state.rainSurfaceIntensity);
    const { data: weatherNow } = useWeatherNow(
        !weatherDisabled && !weather,
        farmId,
    );
    const slugWeather = useMemo(
        () =>
            resolveSlugWeather({
                gameWeather,
                weatherDisabled,
                weatherNow,
                weatherOverride: weather,
            }),
        [gameWeather, weather, weatherDisabled, weatherNow],
    );
    const observedRainIntensity = quantizeSlugSurfaceWetness(
        Math.max(recentWetness, slugWeather.rainy ?? 0),
    );
    const [rainHistory, setRainHistory] =
        useState<SlugRainHistory>(emptySlugRainHistory);
    useEffect(() => {
        if (weatherDisabled) {
            setRainHistory(emptySlugRainHistory);
            return;
        }
        setRainHistory((previous) =>
            updateSlugRainHistory({
                nowMs: Date.now(),
                previous,
                rainIntensity: observedRainIntensity,
            }),
        );
    }, [observedRainIntensity, weatherDisabled]);
    const rainHistoryDeadlineMs = useMemo(() => {
        const rainEndedAt = rainHistory.lastRainEndedAtMs;
        return rainEndedAt === null
            ? null
            : globalThis.performance.now() +
                  Math.max(
                      1,
                      rainEndedAt + slugPostRainWindowMs - Date.now() + 1,
                  );
    }, [rainHistory.lastRainEndedAtMs]);
    useSceneDeadline({
        callback: () => {
            const rainEndedAt = rainHistory.lastRainEndedAtMs;
            if (rainEndedAt === null) {
                return;
            }
            setRainHistory((current) =>
                current.lastRainEndedAtMs === rainEndedAt
                    ? { ...current, lastRainEndedAtMs: null }
                    : current,
            );
        },
        deadlineMs: rainHistoryDeadlineMs,
        owner: 'fauna:slugs:post-rain-window',
    });
    const postRainSurfaceWetness = weatherDisabled
        ? 0
        : getSlugPostRainWetness({
              history: rainHistory,
              nowMs: Date.now(),
              rainIntensity: observedRainIntensity,
          });
    const habitat = useMemo(
        () =>
            createSlugHabitatCandidates({
                blockData,
                raisedBeds: garden?.raisedBeds,
                recentWetness: postRainSurfaceWetness,
                stacks: garden?.stacks,
                weather: slugWeather,
            }),
        [
            blockData,
            garden?.raisedBeds,
            garden?.stacks,
            postRainSurfaceWetness,
            slugWeather,
        ],
    );
    const plan = useMemo(
        () =>
            createSlugSpawnPlan({
                candidates: habitat,
                seed:
                    spawnSeed ??
                    hashSlugSeed(`garden:${garden?.id ?? 'unassigned'}`),
            }),
        [garden?.id, habitat, spawnSeed],
    );
    const [population, setPopulation] =
        useState<SlugPopulationState>(emptySlugPopulation);
    const requestRender = useSceneRenderRequest();
    const reconcilePopulation = useCallback(() => {
        setPopulation((previous) => {
            const next = reconcileSlugPopulation({
                nowMs: Date.now(),
                plan,
                previous,
            });
            return slugPopulationStatesEqual(previous, next) ? previous : next;
        });
    }, [plan]);

    useEffect(() => {
        reconcilePopulation();
    }, [reconcilePopulation]);
    const populationTransitionActive = population.entries.some(
        (entry) => entry.lifecycle !== 'active',
    );
    useSceneFixedStepWork({
        callback: reconcilePopulation,
        enabled: populationTransitionActive,
        maxDeltaMs: 500,
        owner: 'fauna:slugs:population',
        stepsPerSecond: 2,
    });
    const populationCooldownDeadlineMs = useMemo(() => {
        let nextCooldownAtMs = Number.POSITIVE_INFINITY;
        for (const spawn of plan) {
            if (
                population.entries.some(
                    (entry) =>
                        entry.spawn.id === spawn.id &&
                        entry.lifecycle !== 'departing',
                )
            ) {
                continue;
            }
            const cooldownUntilMs = population.cooldownUntilById[spawn.id] ?? 0;
            if (cooldownUntilMs > 0) {
                nextCooldownAtMs = Math.min(nextCooldownAtMs, cooldownUntilMs);
            }
        }
        return Number.isFinite(nextCooldownAtMs)
            ? globalThis.performance.now() +
                  Math.max(1, nextCooldownAtMs - Date.now() + 1)
            : null;
    }, [plan, population]);
    useSceneDeadline({
        callback: reconcilePopulation,
        deadlineMs: populationCooldownDeadlineMs,
        owner: 'fauna:slugs:population-cooldown',
    });
    const activeSlugCount = population.entries.length;
    useEffect(() => {
        requestRender(
            activeSlugCount > 0
                ? 'fauna:slugs:population-active'
                : 'fauna:slugs:population-empty',
        );
    }, [activeSlugCount, requestRender]);
    useSceneTimeInvalidation(
        'fauna:slugs',
        population.entries.length > 0,
        sceneFrameRates.ambient,
    );

    return (
        <group name="EnvironmentSlugs">
            {population.entries.map((entry) => (
                <SlugActor
                    key={entry.spawn.id}
                    entry={entry}
                    habitat={habitat}
                />
            ))}
        </group>
    );
}
