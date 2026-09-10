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
} from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
import { getRaisedBedFootprintSegments } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import {
    getGridPositionFromIndex,
    type RaisedBedOrientation,
} from '../../utils/raisedBedOrientation';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import { AnimalTargetDebugMarker } from '../animals/AnimalDebugIndicators';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import { createAnimalBlockedCells } from '../animals/animalMovementTerrain';
import { getCactusVariantConfig } from '../Cactus';
import { tulipBouquetStems } from '../tulipBouquet';
import {
    createLadybugRandom,
    createLadybugSurfaceOffset,
    getLadybugCrawlSeconds,
    getLadybugPauseSeconds,
    isLadybugActive,
    isLadybugFloweringPlantStatus,
    type LadybugBlockedCell,
    type LadybugSpawnAssignment,
    type LadybugSurfaceCandidate,
    type LadybugWeather,
    ladybugGardenPopulationCap,
    resolveLadybugHabitatChange,
    selectLadybugRelocationTarget,
    selectLadybugSpawnAssignments,
    shouldLadybugDespawnSlot,
    shouldLadybugTakeFlight,
    smoothLadybugTransition,
} from './ladybugBehavior';

type LadybugRaisedBedField = {
    active?: boolean | null;
    plantSortId?: number | null;
    plantStatus?: string | null;
    positionIndex: number;
};

type LadybugWeatherOverride = Partial<NonNullable<GameState['weather']>>;

type LadybugGarden = {
    id?: number | string;
    raisedBeds: {
        blockId: string | null;
        fields?: LadybugRaisedBedField[] | null;
        id: number;
        orientation?: RaisedBedOrientation;
    }[];
    stacks: Stack[];
};

type RuntimeLadybugTarget = LadybugSurfaceCandidate & {
    position: Vector3;
};

type SurfaceOffset = { x: number; z: number };

type HiddenState = { phase: 'hidden' };

type CrawlState = {
    duration: number;
    fromOffset: SurfaceOffset;
    phase: 'crawl';
    startedAt: number;
    target: RuntimeLadybugTarget;
    toOffset: SurfaceOffset;
};

type PauseState = {
    duration: number;
    offset: SurfaceOffset;
    phase: 'pause';
    startedAt: number;
    target: RuntimeLadybugTarget;
};

type WingOpeningState = {
    destination: RuntimeLadybugTarget;
    duration: number;
    from: Vector3;
    phase: 'wing-opening';
    startedAt: number;
    target: RuntimeLadybugTarget;
};

type TakeoffState = {
    destination: RuntimeLadybugTarget;
    duration: number;
    from: Vector3;
    phase: 'takeoff';
    startedAt: number;
    target: RuntimeLadybugTarget;
};

type FlightState = {
    destination: RuntimeLadybugTarget;
    duration: number;
    from: Vector3;
    phase: 'flight';
    startedAt: number;
    target: RuntimeLadybugTarget;
    to: Vector3;
};

type LandingState = {
    duration: number;
    from: Vector3;
    offset: SurfaceOffset;
    phase: 'landing';
    startedAt: number;
    target: RuntimeLadybugTarget;
    to: Vector3;
};

type DespawnState = {
    duration: number;
    from: Vector3;
    phase: 'despawn';
    startedAt: number;
    target: RuntimeLadybugTarget | null;
};

type LadybugRuntimeState =
    | HiddenState
    | CrawlState
    | PauseState
    | WingOpeningState
    | TakeoffState
    | FlightState
    | LandingState
    | DespawnState;

type LadybugRigNode = {
    basePositionY: number;
    baseRotationX: number;
    baseRotationY: number;
    baseRotationZ: number;
    object: Object3D | null;
};

type LadybugRig = {
    antennaLeft: LadybugRigNode;
    antennaRight: LadybugRigNode;
    body: LadybugRigNode;
    elytraLeft: LadybugRigNode;
    elytraRight: LadybugRigNode;
    legsLeft: LadybugRigNode[];
    legsRight: LadybugRigNode[];
    wingLeft: LadybugRigNode;
    wingRight: LadybugRigNode;
};

const clearWarmLadybugWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    temperature: 24,
    thundery: 0,
    windSpeed: 0,
} satisfies LadybugWeather;

const ladybugScale = 0.17 * 0.5;
const ladybugSurfaceLift = 0.015;
const raisedBedLadybugHeight = 0.33;
const tulipLadybugHeight = 0.48;
const cactusLadybugHeight = 0.045;
const wingOpeningSeconds = 0.38;
const takeoffSeconds = 0.28;
const landingSeconds = 0.42;
const despawnSeconds = 0.55;
const ladybugFlightSpeedBlocksPerSecond = 1.35;
const ladybugFlightArcHeight = 0.32;
const disturbanceReactionWindowMs = 2500;
const fullTurn = Math.PI * 2;
const yAxis = new Vector3(0, 1, 0);
const ladybugDebugBehaviors = ['crawl', 'pause', 'flight', 'despawn'];
const ladybugSlots = Array.from(
    { length: ladybugGardenPopulationCap },
    (_, slot) => ({ id: `ladybug-slot-${slot + 1}`, slot }),
);

function findBlockPlacement(stacks: Stack[], blockId: string) {
    for (const stack of stacks) {
        const block = stack.blocks.find(
            (candidate) => candidate.id === blockId,
        );
        if (block) {
            return { block, stack };
        }
    }
    return null;
}

function isHostBlockTopmost(stack: Stack, hostBlockId: string) {
    return stack.blocks.at(-1)?.id === hostBlockId;
}

function rotateLocalPosition(position: Vector3, rotation: number) {
    return position.clone().applyAxisAngle(yAxis, rotation * (Math.PI / 2));
}

function createTulipLadybugTargets(
    garden: LadybugGarden,
    blockData: BlockData[] | null | undefined,
) {
    const targets: RuntimeLadybugTarget[] = [];
    const stem = tulipBouquetStems[0];
    if (!stem) {
        return targets;
    }

    for (const stack of garden.stacks) {
        for (const block of stack.blocks) {
            if (block.name !== 'Tulip') {
                continue;
            }
            const offset = rotateLocalPosition(
                new Vector3(stem.position[0], 0, stem.position[2]),
                block.rotation,
            );
            targets.push({
                crawlRadius: 0.09,
                flowering: true,
                hostBlockId: block.id,
                hostIsTopmost: isHostBlockTopmost(stack, block.id),
                id: `tulip-${block.id}-${stem.key}`,
                kind: 'tulip-flower',
                position: new Vector3(
                    stack.position.x + offset.x,
                    getStackHeight(blockData, stack, block) +
                        tulipLadybugHeight,
                    stack.position.z + offset.z,
                ),
            });
        }
    }
    return targets;
}

function createCactusLadybugTargets(
    garden: LadybugGarden,
    blockData: BlockData[] | null | undefined,
) {
    const targets: RuntimeLadybugTarget[] = [];

    for (const stack of garden.stacks) {
        for (const block of stack.blocks) {
            const config = getCactusVariantConfig(block.name);
            if (!config) {
                continue;
            }

            const baseHeight = getStackHeight(blockData, stack, block);
            for (const flower of config.flowers) {
                const offset = rotateLocalPosition(
                    new Vector3(
                        flower.position[0] * config.scale,
                        0,
                        flower.position[2] * config.scale,
                    ),
                    block.rotation,
                );
                targets.push({
                    crawlRadius: 0.075,
                    flowering: true,
                    hostBlockId: block.id,
                    hostIsTopmost: isHostBlockTopmost(stack, block.id),
                    id: `cactus-${block.id}-${flower.id}`,
                    kind: 'cactus-flower',
                    position: new Vector3(
                        stack.position.x + offset.x,
                        baseHeight -
                            config.groundSink +
                            flower.position[1] * config.scale +
                            cactusLadybugHeight,
                        stack.position.z + offset.z,
                    ),
                });
            }
        }
    }
    return targets;
}

function createRaisedBedLadybugTargets(
    garden: LadybugGarden,
    blockData: BlockData[] | null | undefined,
) {
    const targets: RuntimeLadybugTarget[] = [];

    for (const raisedBed of garden.raisedBeds) {
        const fields =
            raisedBed.fields?.filter(
                (field) =>
                    isRaisedBedFieldOccupied(field) &&
                    isLadybugFloweringPlantStatus(field.plantStatus),
            ) ?? [];
        const blockId = raisedBed.blockId;
        if (!blockId || fields.length <= 0) {
            continue;
        }

        const placement = findBlockPlacement(garden.stacks, blockId);
        if (!placement) {
            continue;
        }
        const orientation = raisedBed.orientation ?? 'vertical';
        const currentStackHeight = getStackHeight(
            blockData,
            placement.stack,
            placement.block,
        );

        for (const segment of getRaisedBedFootprintSegments(
            placement.block.rotation,
        )) {
            const offsetX =
                orientation === 'vertical'
                    ? 0.31 - segment.blockIndex * 0.05
                    : 0.27;
            const offsetZ =
                orientation === 'vertical'
                    ? 0.27
                    : 0.27 + segment.blockIndex * 0.05;
            const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
            const multiplierZ = orientation === 'vertical' ? 0.27 : 0.285;

            for (const field of fields) {
                const localPositionIndex =
                    field.positionIndex - segment.blockOffset;
                if (localPositionIndex < 0 || localPositionIndex >= 9) {
                    continue;
                }
                const { row, col } = getGridPositionFromIndex(
                    localPositionIndex,
                    orientation,
                );
                targets.push({
                    crawlRadius: 0.12,
                    flowering: true,
                    hostBlockId: blockId,
                    hostIsTopmost: isHostBlockTopmost(placement.stack, blockId),
                    id: `raised-bed-${raisedBed.id}-${field.positionIndex}`,
                    kind: 'crop-flower',
                    position: new Vector3(
                        placement.stack.position.x +
                            segment.offset.x +
                            col * multiplierX -
                            offsetX,
                        currentStackHeight + 0.25 + raisedBedLadybugHeight,
                        placement.stack.position.z +
                            segment.offset.z +
                            (2 - row) * multiplierZ -
                            offsetZ,
                    ),
                });
            }
        }
    }
    return targets;
}

function createLadybugTargets(
    garden: LadybugGarden | null | undefined,
    blockData: BlockData[] | null | undefined,
) {
    if (!garden) {
        return [];
    }
    return [
        ...createRaisedBedLadybugTargets(garden, blockData),
        ...createTulipLadybugTargets(garden, blockData),
        ...createCactusLadybugTargets(garden, blockData),
    ];
}

function positionOnTarget(target: RuntimeLadybugTarget, offset: SurfaceOffset) {
    return new Vector3(
        target.position.x + offset.x,
        target.position.y + ladybugSurfaceLift,
        target.position.z + offset.z,
    );
}

function createCrawlState({
    fromOffset,
    now,
    random,
    target,
}: {
    fromOffset: SurfaceOffset;
    now: number;
    random: () => number;
    target: RuntimeLadybugTarget;
}): CrawlState {
    return {
        duration: getLadybugCrawlSeconds(random),
        fromOffset,
        phase: 'crawl',
        startedAt: now,
        target,
        toOffset: createLadybugSurfaceOffset(target.crawlRadius, random),
    };
}

function createPauseState(
    runtime: CrawlState,
    now: number,
    random: () => number,
) {
    return {
        duration: getLadybugPauseSeconds(random),
        offset: runtime.toOffset,
        phase: 'pause',
        startedAt: now,
        target: runtime.target,
    } satisfies PauseState;
}

function createWingOpeningState({
    destination,
    from,
    now,
    target,
}: {
    destination: RuntimeLadybugTarget;
    from: Vector3;
    now: number;
    target: RuntimeLadybugTarget;
}): WingOpeningState {
    return {
        destination,
        duration: wingOpeningSeconds,
        from: from.clone(),
        phase: 'wing-opening',
        startedAt: now,
        target,
    };
}

function createDespawnState(
    from: Vector3,
    now: number,
    target: RuntimeLadybugTarget | null,
): DespawnState {
    return {
        duration: despawnSeconds,
        from: from.clone(),
        phase: 'despawn',
        startedAt: now,
        target,
    };
}

function flightDuration(from: Vector3, to: Vector3) {
    return MathUtils.clamp(
        from.distanceTo(to) / ladybugFlightSpeedBlocksPerSecond,
        0.9,
        3.8,
    );
}

function facePosition(group: Group, target: Vector3, delta: number) {
    const dx = target.x - group.position.x;
    const dz = target.z - group.position.z;
    if (Math.hypot(dx, dz) <= 0.001) {
        return;
    }
    const targetYaw = Math.atan2(dx, dz);
    const difference =
        MathUtils.euclideanModulo(
            targetYaw - group.rotation.y + Math.PI,
            fullTurn,
        ) - Math.PI;
    group.rotation.y += difference * (1 - Math.exp(-10 * delta));
}

function phaseProgress(runtime: LadybugRuntimeState, now: number) {
    if (runtime.phase === 'hidden') {
        return 0;
    }
    return MathUtils.clamp((now - runtime.startedAt) / runtime.duration, 0, 1);
}

function flightPosition(runtime: FlightState, progress: number) {
    const eased = smoothLadybugTransition(progress);
    const position = runtime.from.clone().lerp(runtime.to, eased);
    position.y += Math.sin(progress * Math.PI) * ladybugFlightArcHeight;
    const side = new Vector3(
        -(runtime.to.z - runtime.from.z),
        0,
        runtime.to.x - runtime.from.x,
    );
    if (side.lengthSq() > 0.0001) {
        side.normalize().multiplyScalar(Math.sin(progress * fullTurn) * 0.035);
        position.add(side);
    }
    return position;
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

function isDisturbanceRelevant(
    runtime: LadybugRuntimeState,
    group: Group,
    disturbance: AnimalDisturbance,
) {
    const target = runtime.phase === 'hidden' ? null : runtime.target;
    return (
        target?.hostBlockId === disturbance.sourceBlockId ||
        distanceToDisturbance(group.position, disturbance) <= disturbance.radius
    );
}

function cloneLadybugMaterial(material: Material, objectName: string) {
    if (!(material instanceof MeshStandardMaterial)) {
        return material.clone();
    }
    const clone = material.clone();
    clone.metalness = 0;
    if (objectName.includes('Underwing')) {
        clone.depthWrite = false;
        clone.opacity = 0.76;
        clone.roughness = 0.48;
        clone.side = DoubleSide;
        clone.transparent = true;
    } else if (objectName.includes('Elytra')) {
        clone.roughness = 0.68;
    } else {
        clone.roughness = 0.78;
    }
    return clone;
}

function prepareLadybugMesh(object: Mesh) {
    const isUnderwing = object.name.includes('Underwing');
    object.receiveShadow = !isUnderwing;
    object.material = Array.isArray(object.material)
        ? object.material.map((material) =>
              cloneLadybugMaterial(material, object.name),
          )
        : cloneLadybugMaterial(object.material, object.name);
}

function getRigNode(scene: Object3D, name: string): LadybugRigNode {
    const object = scene.getObjectByName(name) ?? null;
    return {
        basePositionY: object?.position.y ?? 0,
        baseRotationX: object?.rotation.x ?? 0,
        baseRotationY: object?.rotation.y ?? 0,
        baseRotationZ: object?.rotation.z ?? 0,
        object,
    };
}

function dampRotation(
    node: LadybugRigNode,
    targetX: number,
    targetY: number,
    targetZ: number,
    delta: number,
    damping = 18,
) {
    if (!node.object) {
        return;
    }
    node.object.rotation.x = MathUtils.damp(
        node.object.rotation.x,
        targetX,
        damping,
        delta,
    );
    node.object.rotation.y = MathUtils.damp(
        node.object.rotation.y,
        targetY,
        damping,
        delta,
    );
    node.object.rotation.z = MathUtils.damp(
        node.object.rotation.z,
        targetZ,
        damping,
        delta,
    );
}

function updateLadybugRig({
    delta,
    now,
    progress,
    rig,
    runtime,
    seed,
}: {
    delta: number;
    now: number;
    progress: number;
    rig: LadybugRig;
    runtime: LadybugRuntimeState;
    seed: number;
}) {
    const visiblePhase = runtime.phase === 'hidden' ? 'pause' : runtime.phase;
    const wingOpen =
        visiblePhase === 'wing-opening'
            ? smoothLadybugTransition(progress)
            : visiblePhase === 'takeoff' || visiblePhase === 'flight'
              ? 1
              : visiblePhase === 'landing'
                ? 1 - smoothLadybugTransition(progress)
                : visiblePhase === 'despawn'
                  ? smoothLadybugTransition(progress)
                  : 0;
    const flying =
        visiblePhase === 'takeoff' ||
        visiblePhase === 'flight' ||
        visiblePhase === 'landing' ||
        visiblePhase === 'despawn';
    const wingFlutter = flying ? Math.abs(Math.sin(now * 58 + seed)) : 0;

    dampRotation(
        rig.elytraLeft,
        rig.elytraLeft.baseRotationX - wingOpen * 0.16,
        rig.elytraLeft.baseRotationY,
        rig.elytraLeft.baseRotationZ - wingOpen * 0.82,
        delta,
    );
    dampRotation(
        rig.elytraRight,
        rig.elytraRight.baseRotationX - wingOpen * 0.16,
        rig.elytraRight.baseRotationY,
        rig.elytraRight.baseRotationZ + wingOpen * 0.82,
        delta,
    );
    if (rig.wingLeft.object) {
        rig.wingLeft.object.visible = wingOpen > 0.025;
    }
    if (rig.wingRight.object) {
        rig.wingRight.object.visible = wingOpen > 0.025;
    }
    dampRotation(
        rig.wingLeft,
        rig.wingLeft.baseRotationX + wingOpen * 0.08,
        rig.wingLeft.baseRotationY,
        rig.wingLeft.baseRotationZ - wingOpen * (0.78 + wingFlutter * 0.8),
        delta,
        28,
    );
    dampRotation(
        rig.wingRight,
        rig.wingRight.baseRotationX + wingOpen * 0.08,
        rig.wingRight.baseRotationY,
        rig.wingRight.baseRotationZ + wingOpen * (0.78 + wingFlutter * 0.8),
        delta,
        28,
    );

    const antennaAmount = flying ? 0.08 : 0.18;
    dampRotation(
        rig.antennaLeft,
        rig.antennaLeft.baseRotationX +
            Math.sin(now * 3.8 + seed) * antennaAmount,
        rig.antennaLeft.baseRotationY,
        rig.antennaLeft.baseRotationZ -
            Math.sin(now * 2.9 + seed * 0.7) * antennaAmount,
        delta,
        12,
    );
    dampRotation(
        rig.antennaRight,
        rig.antennaRight.baseRotationX +
            Math.sin(now * 3.5 + seed + 1.2) * antennaAmount,
        rig.antennaRight.baseRotationY,
        rig.antennaRight.baseRotationZ +
            Math.sin(now * 3.1 + seed * 0.8) * antennaAmount,
        delta,
        12,
    );

    const crawling = visiblePhase === 'crawl';
    rig.legsLeft.forEach((leg, index) => {
        const step = crawling
            ? Math.sin(now * 10 + seed + index * Math.PI) * 0.3
            : flying
              ? -0.2
              : Math.sin(now * 2 + seed + index) * 0.035;
        dampRotation(
            leg,
            leg.baseRotationX + step,
            leg.baseRotationY,
            leg.baseRotationZ - (flying ? 0.16 : 0),
            delta,
            20,
        );
    });
    rig.legsRight.forEach((leg, index) => {
        const step = crawling
            ? Math.sin(now * 10 + seed + index * Math.PI + Math.PI) * 0.3
            : flying
              ? -0.2
              : Math.sin(now * 2.2 + seed + index + 1) * 0.035;
        dampRotation(
            leg,
            leg.baseRotationX + step,
            leg.baseRotationY,
            leg.baseRotationZ + (flying ? 0.16 : 0),
            delta,
            20,
        );
    });

    if (rig.body.object) {
        const bob = crawling
            ? Math.abs(Math.sin(now * 10 + seed)) * 0.018
            : flying
              ? Math.sin(now * 8 + seed) * 0.025
              : Math.sin(now * 2.4 + seed) * 0.006;
        rig.body.object.position.y = MathUtils.damp(
            rig.body.object.position.y,
            rig.body.basePositionY + bob,
            18,
            delta,
        );
    }
}

function runtimeTarget(runtime: LadybugRuntimeState) {
    return runtime.phase === 'hidden' ? null : runtime.target;
}

function createDebugEntry({
    actor,
    id,
    now,
    runtime,
}: {
    actor: Group;
    id: string;
    now: number;
    runtime: LadybugRuntimeState;
}): AnimalDebugEntry {
    const target = runtimeTarget(runtime);
    const phase = runtime.phase === 'hidden' ? 'despawn' : runtime.phase;
    return {
        activity:
            phase === 'crawl'
                ? 'crawling on flowering plant'
                : phase === 'pause'
                  ? 'pausing on plant surface'
                  : phase === 'despawn'
                    ? 'leaving unsuitable habitat'
                    : 'relocating between safe plant surfaces',
        behavior: phase,
        debugBehaviors: ladybugDebugBehaviors,
        id,
        label: id,
        phase,
        position: {
            x: Math.round(actor.position.x * 100) / 100,
            y: Math.round(actor.position.y * 100) / 100,
            z: Math.round(actor.position.z * 100) / 100,
        },
        species: 'Ladybug',
        targetId: target?.id ?? `${id}:none`,
        updatedAt: now,
    };
}

function LadybugActor({
    active,
    assignment,
    blockedCells,
    onRuntimeActiveChange,
    slot,
    targets,
}: {
    active: boolean;
    assignment: LadybugSpawnAssignment | null;
    blockedCells: LadybugBlockedCell[];
    onRuntimeActiveChange: (slot: number, active: boolean) => void;
    slot: number;
    targets: RuntimeLadybugTarget[];
}) {
    const gltf = useGameGLTF('Ladybug');
    const { enableDebugHudFlag = false } = useGameFlags();
    const groupRef = useRef<Group>(null);
    const targetDebugRef = useRef<Group>(null);
    const runtimeRef = useRef<LadybugRuntimeState>({ phase: 'hidden' });
    const randomRef = useRef(createLadybugRandom(assignment?.seed ?? slot));
    const assignmentSeedRef = useRef<number | null>(null);
    const transitionSequenceRef = useRef(0);
    const lastDebugUpdateRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const lastDisturbanceSequenceRef = useRef(0);
    const runtimeActiveRef = useRef(false);
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
    const actorId = `ladybug-${slot + 1}`;
    const reportRuntimeActive = (nextActive: boolean) => {
        if (runtimeActiveRef.current === nextActive) {
            return;
        }
        runtimeActiveRef.current = nextActive;
        onRuntimeActiveChange(slot, nextActive);
    };

    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        const { primaryCasterCount } = configureActorMeshShadows(
            scene,
            prepareLadybugMesh,
        );
        return {
            primaryCasterCount,
            rig: {
                antennaLeft: getRigNode(scene, 'Ladybug_AntennaPivot_L'),
                antennaRight: getRigNode(scene, 'Ladybug_AntennaPivot_R'),
                body: getRigNode(scene, 'Ladybug_BodyPivot'),
                elytraLeft: getRigNode(scene, 'Ladybug_ElytraPivot_L'),
                elytraRight: getRigNode(scene, 'Ladybug_ElytraPivot_R'),
                legsLeft: [1, 2, 3].map((index) =>
                    getRigNode(scene, `Ladybug_LegPivot_L${index}`),
                ),
                legsRight: [1, 2, 3].map((index) =>
                    getRigNode(scene, `Ladybug_LegPivot_R${index}`),
                ),
                wingLeft: getRigNode(scene, 'Ladybug_WingPivot_L'),
                wingRight: getRigNode(scene, 'Ladybug_WingPivot_R'),
            } satisfies LadybugRig,
            scene,
        };
    }, [gltf.scene]);
    const updateGroundingShadow = useActorGroundingShadow({
        id: actorId,
        primaryCasterCount: model.primaryCasterCount,
        species: 'ladybug',
    });

    useEffect(() => {
        if (!enableDebugHudFlag) {
            removeAnimalDebugEntry(actorId);
        }
        return () => removeAnimalDebugEntry(actorId);
    }, [actorId, enableDebugHudFlag, removeAnimalDebugEntry]);

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
        const now = frameClock.elapsedTime;
        let runtime = runtimeRef.current;

        if (
            assignment &&
            assignmentSeedRef.current !== assignment.seed &&
            runtime.phase === 'hidden'
        ) {
            assignmentSeedRef.current = assignment.seed;
            randomRef.current = createLadybugRandom(assignment.seed);
        }
        const random = randomRef.current;

        if (runtime.phase === 'hidden') {
            group.visible = false;
            if (active && assignment) {
                const target = targets.find(
                    (candidate) => candidate.id === assignment.target.id,
                );
                if (target) {
                    const offset = createLadybugSurfaceOffset(
                        target.crawlRadius,
                        random,
                    );
                    group.position.copy(positionOnTarget(target, offset));
                    group.scale.setScalar(ladybugScale);
                    group.visible = true;
                    runtime = createCrawlState({
                        fromOffset: offset,
                        now,
                        random,
                        target,
                    });
                    runtimeRef.current = runtime;
                }
            }
        } else if (
            shouldLadybugDespawnSlot({
                active,
                hasAssignment: assignment !== null,
                phase: runtime.phase,
            })
        ) {
            runtime = createDespawnState(group.position, now, runtime.target);
            runtimeRef.current = runtime;
        }

        if (runtime.phase === 'hidden') {
            reportRuntimeActive(false);
            return;
        }

        if (runtime.phase === 'crawl' || runtime.phase === 'pause') {
            const habitatChange = resolveLadybugHabitatChange({
                blockedCells,
                candidates: targets,
                currentTarget: runtime.target,
                seed: assignment?.seed ?? slot,
                sequence: transitionSequenceRef.current,
            });
            if (habitatChange.action === 'relocate') {
                transitionSequenceRef.current += 1;
                runtime = createWingOpeningState({
                    destination: habitatChange.target,
                    from: group.position,
                    now,
                    target: runtime.target,
                });
                runtimeRef.current = runtime;
            } else if (habitatChange.action === 'despawn') {
                runtime = createDespawnState(
                    group.position,
                    now,
                    runtime.target,
                );
                runtimeRef.current = runtime;
            } else {
                runtime = { ...runtime, target: habitatChange.target };
                runtimeRef.current = runtime;
            }
        }

        if (
            animalDisturbance &&
            animalDisturbance.sequence !== lastDisturbanceSequenceRef.current
        ) {
            lastDisturbanceSequenceRef.current = animalDisturbance.sequence;
            if (
                Date.now() - animalDisturbance.createdAt <=
                    disturbanceReactionWindowMs &&
                runtime.phase !== 'despawn' &&
                isDisturbanceRelevant(runtime, group, animalDisturbance)
            ) {
                const currentTarget = runtimeTarget(runtime);
                const relocation = currentTarget
                    ? selectLadybugRelocationTarget({
                          blockedCells,
                          candidates: targets,
                          currentTarget,
                          seed: assignment?.seed ?? slot,
                          sequence: ++transitionSequenceRef.current,
                      })
                    : null;
                runtime =
                    relocation && currentTarget
                        ? createWingOpeningState({
                              destination: relocation,
                              from: group.position,
                              now,
                              target: currentTarget,
                          })
                        : createDespawnState(
                              group.position,
                              now,
                              currentTarget,
                          );
                runtimeRef.current = runtime;
            }
        }

        if (
            animalDebugCommand &&
            animalDebugCommand.sequence !==
                lastDebugCommandSequenceRef.current &&
            animalDebugCommand.species === 'Ladybug'
        ) {
            lastDebugCommandSequenceRef.current = animalDebugCommand.sequence;
            if (
                !animalDebugCommand.targetId ||
                animalDebugCommand.targetId === actorId
            ) {
                const currentTarget = runtimeTarget(runtime);
                if (animalDebugCommand.behavior === 'flight' && currentTarget) {
                    const relocation = selectLadybugRelocationTarget({
                        blockedCells,
                        candidates: targets,
                        currentTarget,
                        seed: assignment?.seed ?? slot,
                        sequence: ++transitionSequenceRef.current,
                    });
                    if (relocation) {
                        runtime = createWingOpeningState({
                            destination: relocation,
                            from: group.position,
                            now,
                            target: currentTarget,
                        });
                        runtimeRef.current = runtime;
                    }
                } else if (animalDebugCommand.behavior === 'despawn') {
                    runtime = createDespawnState(
                        group.position,
                        now,
                        currentTarget,
                    );
                    runtimeRef.current = runtime;
                }
            }
        }

        const progress = phaseProgress(runtime, now);
        switch (runtime.phase) {
            case 'crawl': {
                const eased = smoothLadybugTransition(progress);
                const nextOffset = {
                    x: MathUtils.lerp(
                        runtime.fromOffset.x,
                        runtime.toOffset.x,
                        eased,
                    ),
                    z: MathUtils.lerp(
                        runtime.fromOffset.z,
                        runtime.toOffset.z,
                        eased,
                    ),
                };
                const nextPosition = positionOnTarget(
                    runtime.target,
                    nextOffset,
                );
                facePosition(group, nextPosition, delta);
                group.position.copy(nextPosition);
                if (progress >= 1) {
                    runtime = createPauseState(runtime, now, random);
                    runtimeRef.current = runtime;
                }
                break;
            }
            case 'pause': {
                group.position.copy(
                    positionOnTarget(runtime.target, runtime.offset),
                );
                if (progress >= 1) {
                    const relocation = shouldLadybugTakeFlight(random)
                        ? selectLadybugRelocationTarget({
                              blockedCells,
                              candidates: targets,
                              currentTarget: runtime.target,
                              seed: assignment?.seed ?? slot,
                              sequence: ++transitionSequenceRef.current,
                          })
                        : null;
                    runtime = relocation
                        ? createWingOpeningState({
                              destination: relocation,
                              from: group.position,
                              now,
                              target: runtime.target,
                          })
                        : createCrawlState({
                              fromOffset: runtime.offset,
                              now,
                              random,
                              target: runtime.target,
                          });
                    runtimeRef.current = runtime;
                }
                break;
            }
            case 'wing-opening': {
                group.position.copy(runtime.from);
                if (progress >= 1) {
                    runtime = {
                        destination: runtime.destination,
                        duration: takeoffSeconds,
                        from: runtime.from,
                        phase: 'takeoff',
                        startedAt: now,
                        target: runtime.target,
                    };
                    runtimeRef.current = runtime;
                }
                break;
            }
            case 'takeoff': {
                group.position.copy(runtime.from);
                group.position.y +=
                    smoothLadybugTransition(progress) * ladybugFlightArcHeight;
                if (progress >= 1) {
                    const to = positionOnTarget(
                        runtime.destination,
                        createLadybugSurfaceOffset(
                            runtime.destination.crawlRadius,
                            random,
                        ),
                    );
                    to.y += ladybugFlightArcHeight;
                    runtime = {
                        destination: runtime.destination,
                        duration: flightDuration(group.position, to),
                        from: group.position.clone(),
                        phase: 'flight',
                        startedAt: now,
                        target: runtime.target,
                        to,
                    };
                    runtimeRef.current = runtime;
                }
                break;
            }
            case 'flight': {
                const nextPosition = flightPosition(runtime, progress);
                const lookAhead = flightPosition(
                    runtime,
                    Math.min(1, progress + 0.06),
                );
                facePosition(group, lookAhead, delta);
                group.position.copy(nextPosition);
                if (progress >= 1) {
                    const offset = createLadybugSurfaceOffset(
                        runtime.destination.crawlRadius,
                        random,
                    );
                    runtime = {
                        duration: landingSeconds,
                        from: group.position.clone(),
                        offset,
                        phase: 'landing',
                        startedAt: now,
                        target: runtime.destination,
                        to: positionOnTarget(runtime.destination, offset),
                    };
                    runtimeRef.current = runtime;
                }
                break;
            }
            case 'landing': {
                group.position
                    .copy(runtime.from)
                    .lerp(runtime.to, smoothLadybugTransition(progress));
                if (progress >= 1) {
                    runtime = createCrawlState({
                        fromOffset: runtime.offset,
                        now,
                        random,
                        target: runtime.target,
                    });
                    runtimeRef.current = runtime;
                }
                break;
            }
            case 'despawn': {
                group.position.copy(runtime.from);
                group.position.y +=
                    smoothLadybugTransition(progress) * ladybugFlightArcHeight;
                group.scale.setScalar(
                    ladybugScale * (1 - smoothLadybugTransition(progress)),
                );
                if (progress >= 1) {
                    runtime = { phase: 'hidden' };
                    runtimeRef.current = runtime;
                    group.visible = false;
                    group.scale.setScalar(ladybugScale);
                }
                break;
            }
        }

        const target = runtimeTarget(runtime);
        if (targetDebugRef.current) {
            targetDebugRef.current.visible =
                animalTargetsDebugVisible && target !== null;
            if (target) {
                targetDebugRef.current.position.copy(target.position);
            }
        }

        updateLadybugRig({
            delta,
            now,
            progress,
            rig: model.rig,
            runtime,
            seed: assignment?.seed ?? slot,
        });
        if (updateGroundingShadow) {
            updateGroundingShadow({
                actorY: group.position.y,
                receiverY: target?.position.y ?? group.position.y,
                visible:
                    group.visible &&
                    (runtime.phase === 'crawl' || runtime.phase === 'pause'),
                x: group.position.x,
                yaw: group.rotation.y,
                z: group.position.z,
            });
        }

        if (
            enableDebugHudFlag &&
            runtime.phase !== 'hidden' &&
            now - lastDebugUpdateRef.current >= 0.5
        ) {
            lastDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createDebugEntry({ actor: group, id: actorId, now, runtime }),
            );
        }
        reportRuntimeActive(runtime.phase !== 'hidden');
    });

    useEffect(() => {
        if (!assignment) {
            assignmentSeedRef.current = null;
        }
    }, [assignment]);
    useEffect(
        () => () => onRuntimeActiveChange(slot, false),
        [onRuntimeActiveChange, slot],
    );

    return (
        <>
            <group ref={groupRef} scale={ladybugScale} visible={false}>
                <primitive object={model.scene} />
            </group>
            <AnimalTargetDebugMarker ref={targetDebugRef} color="#ef4444" />
        </>
    );
}

function resolveLadybugWeather({
    gameWeather,
    weatherDisabled,
    weatherNow,
    weatherOverride,
}: {
    gameWeather: GameState['weather'];
    weatherDisabled: boolean;
    weatherNow: LadybugWeather | null | undefined;
    weatherOverride: LadybugWeatherOverride | undefined;
}) {
    if (weatherDisabled || weatherOverride) {
        return { ...clearWarmLadybugWeather, ...weatherOverride };
    }
    if (!weatherNow) {
        return undefined;
    }
    return { ...clearWarmLadybugWeather, ...weatherNow, ...gameWeather };
}

export function Ladybugs({
    farmId,
    garden,
    weather,
    weatherDisabled = false,
}: {
    farmId?: number | null;
    garden: LadybugGarden | null | undefined;
    weather?: LadybugWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const { data: blockData } = useBlockData();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const gameWeather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow(
        !weatherDisabled && !weather,
        farmId,
    );
    const targets = useMemo(
        () => createLadybugTargets(garden, blockData),
        [blockData, garden],
    );
    const blockedCells = useMemo(
        () => createAnimalBlockedCells(garden?.stacks),
        [garden?.stacks],
    );
    const assignments = useMemo(
        () =>
            selectLadybugSpawnAssignments({
                candidates: targets,
                gardenSeed: String(garden?.id ?? 'garden'),
            }),
        [garden?.id, targets],
    );
    const ladybugWeather = resolveLadybugWeather({
        gameWeather,
        weatherDisabled,
        weatherNow,
        weatherOverride: weather,
    });
    const active = isLadybugActive(timeOfDay, ladybugWeather);
    const [runtimeActiveSlots, setRuntimeActiveSlots] = useState(
        () => new Set<number>(),
    );
    const handleRuntimeActiveChange = useCallback(
        (slot: number, nextActive: boolean) => {
            setRuntimeActiveSlots((current) => {
                if (current.has(slot) === nextActive) {
                    return current;
                }
                const next = new Set(current);
                if (nextActive) {
                    next.add(slot);
                } else {
                    next.delete(slot);
                }
                return next;
            });
        },
        [],
    );
    useSceneTimeInvalidation(
        'fauna:ladybugs',
        runtimeActiveSlots.size > 0 || (active && assignments.length > 0),
        sceneFrameRates.ambient,
    );

    if (!garden) {
        return null;
    }

    return ladybugSlots.map(({ id, slot }) => (
        <LadybugActor
            key={id}
            active={active}
            assignment={assignments[slot] ?? null}
            blockedCells={blockedCells}
            onRuntimeActiveChange={handleRuntimeActiveChange}
            slot={slot}
            targets={targets}
        />
    ));
}
