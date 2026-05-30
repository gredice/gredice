import type { BlockData } from '@gredice/client';
import { useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Material, Object3D } from 'three';
import { MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
    type AnimalDisturbance,
    useGameState,
} from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import {
    type BirdBehavior,
    getBirdActivityRange,
    getBirdDwellSeconds,
    isBirdNight,
    pickBirdBehavior,
} from './birdBehavior';

type BirdTarget = {
    id: string;
    behavior: BirdBehavior;
    blockId?: string;
    circle?: BirdCircleMotion;
    facingYaw?: number;
    position: Vector3;
};

type BirdCircleMotion = {
    center: Vector3;
    clockwise: -1 | 1;
    circles: number;
    radius: number;
    startAngle: number;
};

type BirdCircleAnchor = {
    id: string;
    position: Vector3;
};

type BirdHabitat = {
    id: string;
    home: BirdTarget;
    airAnchors: Vector3[];
    circleAnchors: BirdCircleAnchor[];
    trees: BirdTarget[];
    entities: BirdTarget[];
    grounds: BirdTarget[];
    seed: number;
};

type BirdMotion = 'fly' | 'walk';

type FlightFlapState = {
    flapBurstDuration: number;
    flapBurstStartedAt: number | null;
    nextFlapBurstAt: number;
};

type MovingBirdState = FlightFlapState & {
    phase: 'moving';
    target: BirdTarget;
    entryTangent: Vector3;
    exitTangent: Vector3;
    from: Vector3;
    to: Vector3;
    startedAt: number;
    duration: number;
    motion: BirdMotion;
    airUntil: number | null;
    airWaypointIndex: number;
    speedProfile: FlightSpeedProfile;
};

type CirclingBirdState = FlightFlapState & {
    phase: 'circling';
    target: BirdTarget;
    startedAt: number;
    duration: number;
};

type SettledBirdState = {
    phase: 'settled';
    target: BirdTarget;
    dwellUntil: number;
    groundForage: GroundForageState | null;
    hopStartedAt: number | null;
    hopDuration: number;
    hopHeight: number;
    nextHopAt: number;
};

type BirdRuntimeState = MovingBirdState | CirclingBirdState | SettledBirdState;

type FlightSpeedProfile = {
    flutter: number;
    phase: number;
    total: number;
};

type GroundForageState = {
    currentOffset: Vector3;
    fromOffset: Vector3;
    moveDuration: number;
    moveStartedAt: number | null;
    nextMoveAt: number;
    nextPeckAt: number;
    peckDuration: number;
    peckStartedAt: number | null;
    targetOffset: Vector3;
};

type BirdRigNode = {
    baseRotationX: number;
    baseRotationZ: number;
    object: Object3D | null;
};

type BirdRigParts = {
    flightLegPoseAmount: number;
    footLeft: BirdRigNode;
    groundPeckAmount: number;
    groundPeckTargetAmount: number;
    headPivot: BirdRigNode;
    footRight: BirdRigNode;
    legPivotLeft: BirdRigNode;
    legPivotRight: BirdRigNode;
};

const birdScale = 0.28;
const birdGroundLift = 0.02;
const birdHousePerchYOffset = 1.3;
const birdHouseEntranceYawOffset = Math.PI;
const birdFlightTakeoffLeadSeconds = 0.2;
const birdFlightFlapSpeed = 2.4;
const birdFlightSpeedBlocksPerSecond = 1.62;
const birdFlightTurnDamping = 3.4;
const birdFlightLookAheadProgress = 0.045;
const birdWalkSpeedBlocksPerSecond = 0.24;
const birdCircleSpeedBlocksPerSecond = 1.35;
const birdFlightLegTuckDamping = 10;
const airMinHeight = 1.45;
const airHeightVariance = 1.05;
const airArcMaxHeight = 1;
const circleTallBlockMinPerchY = 0.9;
const circleHeightMaxAboveHome = 3.2;
const circleVerticalBobHeight = 0.16;
const defaultTurnDamping = 8;
const groundForageRadius = 0.34;
const groundForageSpeedBlocksPerSecond = 0.28;
const groundPeckDamping = 18;
const fullTurn = Math.PI * 2;
const birdBeakColor = '#d76516';
const birdLegColor = '#c65f17';
const animalDisturbanceReactionWindowMs = 2500;

const groundBlockNames = new Set([
    'Block_Ground',
    'Block_Ground_Angle',
    'Block_Grass',
    'Block_Grass_Angle',
    'Block_Sand',
    'Block_Sand_Angle',
    'Block_Snow',
    'Block_Snow_Angle',
    'Block_Snow_Falling',
]);

const treeBlockNames = new Set(['Tree', 'Pine', 'PineAdvent']);

const visualPerchYOffsets: Record<string, number> = {
    BirdHouse: birdHousePerchYOffset,
    Tree: 0.9,
    Pine: 1.32,
    PineAdvent: 1.32,
    Bush: 0.55,
    Bucket: 0.6,
    Composter: 0.65,
    GardenBox: 0.75,
    Raised_Bed: 1.05,
    Shade: 1.1,
    ShovelSmall: 0.95,
    Snowman: 0.95,
    StoneLarge: 0.5,
    StoneMedium: 0.35,
    StoneSmall: 0.22,
    DesertStoneLarge: 0.5,
    DesertStoneMedium: 0.35,
    DesertStoneSmall: 0.22,
    Stool: 0.52,
    Tulip: 0.5,
    WaterWell: 1.05,
    BaleHey: 0.5,
    PotLowBowl: 0.26,
    PotRoundedBowl: 0.43,
    PotBulbousNeck: 0.51,
    PotTallTapered: 0.54,
    PotHourglass: 0.47,
    PotStraightShortTub: 0.4,
    PotNarrowFootBowl: 0.39,
    PotSquatRidged: 0.42,
    PotTallSlenderCone: 0.62,
    PotWideLippedCup: 0.49,
};

function hashString(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

function isGroundBlockName(name: string) {
    return groundBlockNames.has(name);
}

function isTreeBlockName(name: string) {
    return treeBlockNames.has(name);
}

function getBlockHeight(
    blockData: BlockData[] | null | undefined,
    blockName: string,
) {
    return (
        blockData?.find((entity) => entity.information.name === blockName)
            ?.attributes.height ?? null
    );
}

function getVisualPerchYOffset(
    blockData: BlockData[] | null | undefined,
    blockName: string,
) {
    return (
        visualPerchYOffsets[blockName] ??
        getBlockHeight(blockData, blockName) ??
        0.65
    );
}

function isCircleAnchorBlock(
    blockData: BlockData[] | null | undefined,
    blockName: string,
) {
    return (
        isTreeBlockName(blockName) ||
        getVisualPerchYOffset(blockData, blockName) >= circleTallBlockMinPerchY
    );
}

function targetForBlock({
    behavior,
    block,
    blockData,
    stack,
}: {
    behavior: BirdBehavior;
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const y =
        getStackHeight(blockData, stack, block) +
        getVisualPerchYOffset(blockData, block.name);
    return {
        behavior,
        blockId: block.id,
        id: `${behavior}-${block.id}`,
        position: new Vector3(stack.position.x, y, stack.position.z),
    } satisfies BirdTarget;
}

function circleAnchorForBlock({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const y =
        getStackHeight(blockData, stack, block) +
        getVisualPerchYOffset(blockData, block.name);
    return {
        id: `circle-${block.id}`,
        position: new Vector3(stack.position.x, y, stack.position.z),
    } satisfies BirdCircleAnchor;
}

function targetForGroundStack(
    stack: Stack,
    blockData: BlockData[] | null | undefined,
) {
    const topY = getStackHeight(blockData, stack) + birdGroundLift;
    return {
        behavior: 'ground',
        id: `ground-${stack.position.x}-${stack.position.z}`,
        position: new Vector3(stack.position.x, topY, stack.position.z),
    } satisfies BirdTarget;
}

function horizontalDistance(left: Vector3, right: Vector3) {
    return Math.hypot(left.x - right.x, left.z - right.z);
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

function isBirdTargetDisturbed(
    target: BirdTarget,
    disturbance: AnimalDisturbance,
) {
    return (
        target.blockId === disturbance.sourceBlockId ||
        distanceToDisturbance(target.position, disturbance) <=
            disturbance.radius
    );
}

function isBirdDisturbanceRelevant({
    disturbance,
    group,
    habitat,
    runtime,
}: {
    disturbance: AnimalDisturbance;
    group: Group;
    habitat: BirdHabitat;
    runtime: BirdRuntimeState;
}) {
    return (
        habitat.home.blockId === disturbance.sourceBlockId ||
        isBirdTargetDisturbed(runtime.target, disturbance) ||
        distanceToDisturbance(group.position, disturbance) <= disturbance.radius
    );
}

function candidatesInRange<T extends { position: Vector3 }>(
    candidates: T[],
    home: BirdTarget,
    range: number,
) {
    return candidates.filter(
        (candidate) =>
            horizontalDistance(candidate.position, home.position) <= range,
    );
}

function pickCandidate<T>(candidates: T[], random: () => number) {
    if (candidates.length <= 0) {
        return null;
    }

    return candidates[Math.floor(random() * candidates.length)] ?? null;
}

function blockRotationToYaw(rotation: number) {
    return rotation * (Math.PI / 2) + birdHouseEntranceYawOffset;
}

function createAirTarget({
    anchors,
    home,
    index,
    random,
}: {
    anchors: Vector3[];
    home: BirdTarget;
    index: number;
    random: () => number;
}) {
    const anchor =
        anchors[Math.floor(random() * anchors.length)] ?? home.position;
    const jitterRadius = 0.28 + random() * 0.22;
    const jitterAngle = random() * fullTurn;
    return {
        behavior: 'air',
        id: `air-${home.id}-${index}`,
        position: new Vector3(
            anchor.x + Math.cos(jitterAngle) * jitterRadius,
            home.position.y + airMinHeight + random() * airHeightVariance,
            anchor.z + Math.sin(jitterAngle) * jitterRadius,
        ),
    } satisfies BirdTarget;
}

function createCircleTarget({
    anchor,
    home,
    random,
}: {
    anchor: BirdCircleAnchor;
    home: BirdTarget;
    random: () => number;
}) {
    const radius = 0.95 + random() * 0.55;
    const startAngle = random() * fullTurn;
    const clockwise: -1 | 1 = random() < 0.5 ? -1 : 1;
    const centerY = MathUtils.clamp(
        anchor.position.y + 1.15 + random() * 0.55,
        home.position.y + 1.15,
        home.position.y + circleHeightMaxAboveHome,
    );
    const center = new Vector3(anchor.position.x, centerY, anchor.position.z);
    return {
        behavior: 'circle',
        circle: {
            center,
            clockwise,
            circles: 1 + Math.floor(random() * 3),
            radius,
            startAngle,
        },
        id: `circle-${home.id}-${anchor.id}`,
        position: new Vector3(
            center.x + Math.cos(startAngle) * radius,
            center.y,
            center.z + Math.sin(startAngle) * radius,
        ),
    } satisfies BirdTarget;
}

function createBirdHabitats(
    stacks: Stack[] | undefined,
    blockData: BlockData[] | null | undefined,
) {
    const homes: BirdTarget[] = [];
    const airAnchors: Vector3[] = [];
    const circleAnchors: BirdCircleAnchor[] = [];
    const trees: BirdTarget[] = [];
    const entities: BirdTarget[] = [];
    const grounds: BirdTarget[] = [];

    for (const stack of stacks ?? []) {
        airAnchors.push(new Vector3(stack.position.x, 0, stack.position.z));

        for (const block of stack.blocks) {
            if (block.name === 'BirdHouse') {
                homes.push({
                    ...targetForBlock({
                        behavior: 'home',
                        block,
                        blockData,
                        stack,
                    }),
                    facingYaw: blockRotationToYaw(block.rotation),
                });
            }
        }

        const topBlock = stack.blocks.at(-1);
        if (!topBlock) {
            continue;
        }

        if (
            topBlock.name !== 'BirdHouse' &&
            isCircleAnchorBlock(blockData, topBlock.name)
        ) {
            circleAnchors.push(
                circleAnchorForBlock({ block: topBlock, blockData, stack }),
            );
        }

        if (isTreeBlockName(topBlock.name)) {
            trees.push(
                targetForBlock({
                    behavior: 'tree',
                    block: topBlock,
                    blockData,
                    stack,
                }),
            );
            continue;
        }

        if (stack.blocks.length === 1 && isGroundBlockName(topBlock.name)) {
            grounds.push(targetForGroundStack(stack, blockData));
            continue;
        }

        if (
            topBlock.name !== 'BirdHouse' &&
            !isGroundBlockName(topBlock.name)
        ) {
            entities.push(
                targetForBlock({
                    behavior: 'entity',
                    block: topBlock,
                    blockData,
                    stack,
                }),
            );
        }
    }

    return homes.map((home) => ({
        id: home.id,
        home,
        airAnchors,
        circleAnchors,
        trees,
        entities,
        grounds,
        seed: hashString(home.id),
    }));
}

function smoothProgress(progress: number) {
    return progress * progress * (3 - 2 * progress);
}

function movementDuration(
    from: Vector3,
    to: Vector3,
    motion: BirdMotion,
    timeOfDay: number,
) {
    const distance = from.distanceTo(to);
    if (motion === 'walk') {
        return MathUtils.clamp(
            distance / birdWalkSpeedBlocksPerSecond,
            2.4,
            9.5,
        );
    }

    const speed = isBirdNight(timeOfDay)
        ? birdFlightSpeedBlocksPerSecond * 0.82
        : birdFlightSpeedBlocksPerSecond;
    return MathUtils.clamp(distance / speed, 1.05, 7.6);
}

function createFlightTangent(from: Vector3, to: Vector3) {
    const offset = to.clone().sub(from);
    const distance = offset.length();
    if (distance <= 0.001) {
        return new Vector3(0, 0, 0.5);
    }

    return offset.normalize().multiplyScalar(distance * 0.72);
}

function fitFlightTangentToSegment(tangent: Vector3, fallback: Vector3) {
    if (tangent.lengthSq() <= 0.000001) {
        return fallback.clone();
    }

    return tangent.clone().setLength(fallback.length());
}

function hermitePosition({
    entryTangent,
    exitTangent,
    from,
    progress,
    to,
}: {
    entryTangent: Vector3;
    exitTangent: Vector3;
    from: Vector3;
    progress: number;
    to: Vector3;
}) {
    const t2 = progress * progress;
    const t3 = t2 * progress;
    return from
        .clone()
        .multiplyScalar(2 * t3 - 3 * t2 + 1)
        .add(entryTangent.clone().multiplyScalar(t3 - 2 * t2 + progress))
        .add(to.clone().multiplyScalar(-2 * t3 + 3 * t2))
        .add(exitTangent.clone().multiplyScalar(t3 - t2));
}

function flightPositionAt(runtime: MovingBirdState, progress: number) {
    const distance = horizontalDistance(runtime.from, runtime.to);
    const position = hermitePosition({
        entryTangent: runtime.entryTangent,
        exitTangent: runtime.exitTangent,
        from: runtime.from,
        progress,
        to: runtime.to,
    });
    const arc =
        Math.sin(progress * Math.PI) *
        MathUtils.clamp(distance * 0.12, 0.15, airArcMaxHeight);
    position.y += arc;
    return position;
}

function flightSpeedWeight(profile: FlightSpeedProfile, progress: number) {
    const cruiseLift = 0.78 + Math.sin(progress * Math.PI) * 0.42;
    const wingPulse =
        1 +
        Math.sin(progress * fullTurn * 2.35 + profile.phase) * profile.flutter +
        Math.sin(progress * fullTurn * 4.7 + profile.phase * 0.72) *
            profile.flutter *
            0.42;
    return Math.max(0.42, cruiseLift * wingPulse);
}

function integrateFlightSpeedProfile(
    profile: FlightSpeedProfile,
    progress: number,
) {
    const steps = 10;
    const stepSize = progress / steps;
    let total = 0;
    for (let step = 0; step < steps; step += 1) {
        const start = step * stepSize;
        const end = start + stepSize;
        total +=
            ((flightSpeedWeight(profile, start) +
                flightSpeedWeight(profile, end)) /
                2) *
            stepSize;
    }
    return total;
}

function createFlightSpeedProfile(random: () => number): FlightSpeedProfile {
    const profile = {
        flutter: 0.055 + random() * 0.035,
        phase: random() * fullTurn,
        total: 1,
    };
    profile.total = integrateFlightSpeedProfile(profile, 1);
    return profile;
}

function flightProgressAt(runtime: MovingBirdState, progress: number) {
    if (progress <= 0) {
        return 0;
    }
    if (progress >= 1) {
        return 1;
    }

    return MathUtils.clamp(
        integrateFlightSpeedProfile(runtime.speedProfile, progress) /
            runtime.speedProfile.total,
        0,
        1,
    );
}

function facePosition(
    group: Group,
    target: Vector3,
    delta: number,
    turnDamping = defaultTurnDamping,
) {
    const directionX = target.x - group.position.x;
    const directionZ = target.z - group.position.z;
    if (Math.hypot(directionX, directionZ) <= 0.001) {
        return;
    }

    faceYaw(group, Math.atan2(directionX, directionZ), delta, turnDamping);
}

function faceYaw(
    group: Group,
    targetYaw: number,
    delta: number,
    turnDamping = defaultTurnDamping,
) {
    const difference =
        MathUtils.euclideanModulo(
            targetYaw - group.rotation.y + Math.PI,
            fullTurn,
        ) - Math.PI;
    const turnAmount = 1 - Math.exp(-turnDamping * delta);
    group.rotation.y += difference * turnAmount;
}

function hasDifferentGroundTarget(
    current: BirdTarget,
    candidates: BirdTarget[],
) {
    return candidates.some((candidate) => candidate.id !== current.id);
}

function getAirAnchorsInRange(habitat: BirdHabitat, range: number) {
    const anchors = habitat.airAnchors.filter(
        (anchor) => horizontalDistance(anchor, habitat.home.position) <= range,
    );
    return anchors.length > 0 ? anchors : [habitat.home.position];
}

function chooseNextTarget({
    currentTarget,
    habitat,
    random,
    timeOfDay,
}: {
    currentTarget: BirdTarget;
    habitat: BirdHabitat;
    random: () => number;
    timeOfDay: number;
}) {
    const range = getBirdActivityRange(timeOfDay);
    const airAnchors = getAirAnchorsInRange(habitat, range);
    const circleAnchors = candidatesInRange(
        habitat.circleAnchors,
        habitat.home,
        range,
    );
    const trees = candidatesInRange(habitat.trees, habitat.home, range);
    const entities = candidatesInRange(habitat.entities, habitat.home, range);
    const grounds = candidatesInRange(habitat.grounds, habitat.home, range);
    const night = isBirdNight(timeOfDay);

    if (
        currentTarget.behavior === 'ground' &&
        hasDifferentGroundTarget(currentTarget, grounds) &&
        random() < (night ? 0.12 : 0.42)
    ) {
        return (
            pickCandidate(
                grounds.filter(
                    (candidate) => candidate.id !== currentTarget.id,
                ),
                random,
            ) ?? habitat.home
        );
    }

    const behavior = pickBirdBehavior(
        timeOfDay,
        {
            air: true,
            circle: circleAnchors.length > 0,
            tree: trees.length > 0,
            entity: entities.length > 0,
            ground: grounds.length > 0,
        },
        random,
    );

    if (behavior === 'air') {
        return createAirTarget({
            anchors: airAnchors,
            home: habitat.home,
            index: 0,
            random,
        });
    }

    if (behavior === 'circle') {
        const anchor = pickCandidate(circleAnchors, random);
        return anchor
            ? createCircleTarget({ anchor, home: habitat.home, random })
            : habitat.home;
    }

    if (behavior === 'tree') {
        return pickCandidate(trees, random) ?? habitat.home;
    }

    if (behavior === 'entity') {
        return pickCandidate(entities, random) ?? habitat.home;
    }

    if (behavior === 'ground') {
        return pickCandidate(grounds, random) ?? habitat.home;
    }

    return habitat.home;
}

function makeMovingState({
    airUntil,
    airWaypointIndex = 0,
    entryTangent,
    from,
    now,
    random,
    target,
    takeoffLead = true,
    timeOfDay,
}: {
    airUntil?: number | null;
    airWaypointIndex?: number;
    entryTangent?: Vector3;
    from: Vector3;
    now: number;
    random: () => number;
    target: BirdTarget;
    takeoffLead?: boolean;
    timeOfDay: number;
}) {
    const isGroundWalk =
        target.behavior === 'ground' &&
        from.distanceTo(target.position) <= 2.2 &&
        Math.abs(from.y - target.position.y) <= 0.16;
    const motion: BirdMotion = isGroundWalk ? 'walk' : 'fly';
    const nextAirUntil =
        target.behavior === 'air'
            ? (airUntil ?? now + getBirdDwellSeconds('air', timeOfDay, random))
            : null;
    const directFlightTangent = createFlightTangent(from, target.position);
    const nextEntryTangent =
        motion === 'fly'
            ? fitFlightTangentToSegment(
                  entryTangent ?? directFlightTangent,
                  directFlightTangent,
              )
            : new Vector3();
    const nextExitTangent =
        motion === 'fly' ? directFlightTangent : new Vector3();
    const startDelay =
        motion === 'fly' && takeoffLead ? birdFlightTakeoffLeadSeconds : 0;

    return {
        phase: 'moving',
        target,
        entryTangent: nextEntryTangent,
        exitTangent: nextExitTangent,
        from,
        to: target.position.clone(),
        startedAt: now + startDelay,
        duration: movementDuration(from, target.position, motion, timeOfDay),
        motion,
        airUntil: nextAirUntil,
        airWaypointIndex,
        speedProfile: createFlightSpeedProfile(random),
        flapBurstDuration: 0.7 + random() * 0.16,
        flapBurstStartedAt: motion === 'fly' ? now : null,
        nextFlapBurstAt: motion === 'fly' ? now : Number.POSITIVE_INFINITY,
    } satisfies MovingBirdState;
}

function updateFlightFlapping(
    runtime: FlightFlapState,
    now: number,
    random: () => number,
) {
    if (runtime.flapBurstStartedAt == null) {
        if (now < runtime.nextFlapBurstAt) {
            return false;
        }
        runtime.flapBurstStartedAt = now;
    }

    if (now - runtime.flapBurstStartedAt <= runtime.flapBurstDuration) {
        return true;
    }

    runtime.flapBurstStartedAt = null;
    runtime.flapBurstDuration = 0.7 + random() * 0.16;
    runtime.nextFlapBurstAt = now + 0.65 + random() * 0.6;
    return false;
}

function makeCirclingState({
    now,
    random,
    target,
}: {
    now: number;
    random: () => number;
    target: BirdTarget;
}) {
    const circle = target.circle;
    const duration = circle
        ? (fullTurn * circle.radius * circle.circles) /
          birdCircleSpeedBlocksPerSecond
        : 0;
    return {
        phase: 'circling',
        target,
        startedAt: now,
        duration,
        flapBurstDuration: 0.7 + random() * 0.16,
        flapBurstStartedAt: now,
        nextFlapBurstAt: now,
    } satisfies CirclingBirdState;
}

function circlePositionAt(target: BirdTarget, progress: number) {
    const circle = target.circle;
    if (!circle) {
        return target.position.clone();
    }

    const circleProgress = progress * circle.circles;
    const angle =
        circle.startAngle + circle.clockwise * circleProgress * fullTurn;
    return new Vector3(
        circle.center.x + Math.cos(angle) * circle.radius,
        circle.center.y +
            Math.sin(circleProgress * fullTurn * 2) * circleVerticalBobHeight,
        circle.center.z + Math.sin(angle) * circle.radius,
    );
}

function circleFacingPosition(target: BirdTarget, progress: number) {
    const circle = target.circle;
    if (!circle) {
        return target.position;
    }

    const aheadProgress = progress + 0.025;
    return circlePositionAt(target, aheadProgress);
}

function getGroundForageDelay(random: () => number) {
    return 0.9 + random() * 2.1;
}

function getGroundPeckDelay(random: () => number) {
    return 0.45 + random() * 1.6;
}

function pickGroundForageOffset(random: () => number) {
    const radius = Math.sqrt(random()) * groundForageRadius;
    const angle = random() * fullTurn;
    return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
}

function createGroundForageState(
    now: number,
    random: () => number,
): GroundForageState {
    return {
        currentOffset: new Vector3(),
        fromOffset: new Vector3(),
        moveDuration: 0,
        moveStartedAt: null,
        nextMoveAt: now + getGroundForageDelay(random),
        nextPeckAt: now + getGroundPeckDelay(random),
        peckDuration: 0.18 + random() * 0.12,
        peckStartedAt: null,
        targetOffset: new Vector3(),
    };
}

function updateGroundForage({
    now,
    random,
    runtime,
}: {
    now: number;
    random: () => number;
    runtime: SettledBirdState;
}) {
    const groundForage = runtime.groundForage;
    if (!groundForage) {
        return {
            facingTarget: null,
            moving: false,
            offset: new Vector3(),
            peckAmount: 0,
        };
    }

    let moving = false;
    if (groundForage.moveStartedAt === null && now >= groundForage.nextMoveAt) {
        groundForage.moveStartedAt = now;
        groundForage.fromOffset.copy(groundForage.currentOffset);
        groundForage.targetOffset.copy(pickGroundForageOffset(random));
        groundForage.moveDuration = MathUtils.clamp(
            groundForage.fromOffset.distanceTo(groundForage.targetOffset) /
                groundForageSpeedBlocksPerSecond,
            0.45,
            1.5,
        );
    }

    if (groundForage.moveStartedAt !== null) {
        const progress = MathUtils.clamp(
            (now - groundForage.moveStartedAt) / groundForage.moveDuration,
            0,
            1,
        );
        if (progress >= 1) {
            groundForage.currentOffset.copy(groundForage.targetOffset);
            groundForage.moveStartedAt = null;
            groundForage.nextMoveAt = now + getGroundForageDelay(random);
        } else {
            moving = true;
            groundForage.currentOffset
                .copy(groundForage.fromOffset)
                .lerp(groundForage.targetOffset, smoothProgress(progress));
        }
    }

    if (groundForage.peckStartedAt === null && now >= groundForage.nextPeckAt) {
        groundForage.peckStartedAt = now;
        groundForage.peckDuration = 0.18 + random() * 0.12;
    }

    let peckAmount = 0;
    if (groundForage.peckStartedAt !== null) {
        const progress = MathUtils.clamp(
            (now - groundForage.peckStartedAt) / groundForage.peckDuration,
            0,
            1,
        );
        if (progress >= 1) {
            groundForage.peckStartedAt = null;
            groundForage.nextPeckAt = now + getGroundPeckDelay(random);
        } else {
            peckAmount = Math.sin(progress * Math.PI);
        }
    }

    const offset = groundForage.currentOffset.clone();
    const facingTarget = moving
        ? runtime.target.position.clone().add(groundForage.targetOffset)
        : null;

    return { facingTarget, moving, offset, peckAmount };
}

function makeSettledState({
    now,
    random,
    target,
    timeOfDay,
}: {
    now: number;
    random: () => number;
    target: BirdTarget;
    timeOfDay: number;
}) {
    const hopDuration = 0.28 + random() * 0.16;
    return {
        phase: 'settled',
        target,
        dwellUntil:
            now + getBirdDwellSeconds(target.behavior, timeOfDay, random),
        groundForage:
            target.behavior === 'ground'
                ? createGroundForageState(now, random)
                : null,
        hopStartedAt: null,
        hopDuration,
        hopHeight: getHopHeight(target.behavior, random),
        nextHopAt: now + getHopDelay(target.behavior, timeOfDay, random),
    } satisfies SettledBirdState;
}

function getHopDelay(
    behavior: BirdBehavior,
    timeOfDay: number,
    random: () => number,
) {
    if (behavior === 'home') {
        return isBirdNight(timeOfDay)
            ? 9 + random() * 12
            : 4.5 + random() * 7.5;
    }

    return isBirdNight(timeOfDay) ? 5 + random() * 8 : 3 + random() * 6;
}

function getHopHeight(behavior: BirdBehavior, random: () => number) {
    return behavior === 'home'
        ? 0.018 + random() * 0.014
        : 0.022 + random() * 0.018;
}

function settledHopOffset({
    now,
    random,
    runtime,
    timeOfDay,
}: {
    now: number;
    random: () => number;
    runtime: SettledBirdState;
    timeOfDay: number;
}) {
    if (runtime.hopStartedAt == null) {
        if (now < runtime.nextHopAt) {
            return 0;
        }
        runtime.hopStartedAt = now;
    }

    const progress = (now - runtime.hopStartedAt) / runtime.hopDuration;
    if (progress >= 1) {
        runtime.hopStartedAt = null;
        runtime.hopDuration = 0.28 + random() * 0.16;
        runtime.hopHeight = getHopHeight(runtime.target.behavior, random);
        runtime.nextHopAt =
            now + getHopDelay(runtime.target.behavior, timeOfDay, random);
        return 0;
    }

    return Math.sin(progress * Math.PI) * runtime.hopHeight;
}

function cloneBirdPartMaterial(material: Material, color: string) {
    const clone = material.clone();
    if (clone instanceof MeshStandardMaterial) {
        clone.color.set(color);
        clone.metalness = 0;
        clone.roughness = 0.72;
    }

    return clone;
}

function getBirdPartTint(objectName: string) {
    if (objectName.includes('BirdSmall_Beak')) {
        return birdBeakColor;
    }

    if (
        objectName.includes('BirdSmall_Foot') ||
        objectName.includes('BirdSmall_Leg')
    ) {
        return birdLegColor;
    }

    return null;
}

function tintBirdPartMaterial(object: Mesh) {
    const tintColor = getBirdPartTint(object.name);
    if (!tintColor) {
        return;
    }

    object.material = Array.isArray(object.material)
        ? object.material.map((material) =>
              cloneBirdPartMaterial(material, tintColor),
          )
        : cloneBirdPartMaterial(object.material, tintColor);
}

function isMesh(object: Object3D): object is Mesh {
    return object instanceof Mesh;
}

function getBirdRigNode(scene: Object3D, name: string): BirdRigNode {
    const object = scene.getObjectByName(name) ?? null;
    return {
        baseRotationX: object?.rotation.x ?? 0,
        baseRotationZ: object?.rotation.z ?? 0,
        object,
    };
}

function updateFlightLegPose({
    delta,
    flying,
    now,
    rig,
    seed,
}: {
    delta: number;
    flying: boolean;
    now: number;
    rig: BirdRigParts;
    seed: number;
}) {
    const targetAmount = flying ? 1 : 0;
    rig.flightLegPoseAmount = MathUtils.damp(
        rig.flightLegPoseAmount,
        targetAmount,
        birdFlightLegTuckDamping,
        delta,
    );

    const amount = rig.flightLegPoseAmount;
    const pulse = Math.sin(now * 13.5 + seed) * 0.045 * amount;
    const legRotationX = (1.08 + pulse) * amount;
    const footRotationX = -0.42 * amount;

    if (rig.legPivotLeft.object) {
        rig.legPivotLeft.object.rotation.x =
            rig.legPivotLeft.baseRotationX + legRotationX;
        rig.legPivotLeft.object.rotation.z =
            rig.legPivotLeft.baseRotationZ + 0.08 * amount;
    }
    if (rig.legPivotRight.object) {
        rig.legPivotRight.object.rotation.x =
            rig.legPivotRight.baseRotationX + legRotationX;
        rig.legPivotRight.object.rotation.z =
            rig.legPivotRight.baseRotationZ - 0.08 * amount;
    }
    if (rig.footLeft.object) {
        rig.footLeft.object.rotation.x =
            rig.footLeft.baseRotationX + footRotationX;
    }
    if (rig.footRight.object) {
        rig.footRight.object.rotation.x =
            rig.footRight.baseRotationX + footRotationX;
    }
}

function updateGroundPeckPose({
    delta,
    rig,
}: {
    delta: number;
    rig: BirdRigParts;
}) {
    rig.groundPeckAmount = MathUtils.damp(
        rig.groundPeckAmount,
        rig.groundPeckTargetAmount,
        groundPeckDamping,
        delta,
    );

    if (rig.headPivot.object) {
        rig.headPivot.object.rotation.x =
            rig.headPivot.baseRotationX + rig.groundPeckAmount * 0.62;
    }
}

function getBirdDebugActivity(runtime: BirdRuntimeState) {
    if (runtime.phase === 'moving') {
        return runtime.motion === 'fly'
            ? `flying to ${runtime.target.behavior}`
            : `walking to ${runtime.target.behavior}`;
    }

    if (runtime.phase === 'circling') {
        return 'circling';
    }

    if (runtime.target.behavior === 'ground') {
        if (runtime.groundForage?.peckStartedAt != null) {
            return 'pecking';
        }

        if (runtime.groundForage?.moveStartedAt != null) {
            return 'foraging walk';
        }

        return 'foraging';
    }

    return `settled on ${runtime.target.behavior}`;
}

function roundBirdDebugCoordinate(value: number) {
    return Math.round(value * 100) / 100;
}

function createBirdDebugEntry({
    group,
    habitat,
    now,
    runtime,
}: {
    group: Group;
    habitat: BirdHabitat;
    now: number;
    runtime: BirdRuntimeState;
}): AnimalDebugEntry {
    return {
        id: habitat.id,
        species: 'Bird',
        label: habitat.id.replace(/^home-/, ''),
        phase: runtime.phase,
        behavior: runtime.target.behavior,
        activity: getBirdDebugActivity(runtime),
        targetId: runtime.target.id,
        position: {
            x: roundBirdDebugCoordinate(group.position.x),
            y: roundBirdDebugCoordinate(group.position.y),
            z: roundBirdDebugCoordinate(group.position.z),
        },
        updatedAt: now,
    };
}

function Bird({ habitat }: { habitat: BirdHabitat }) {
    const gltf = useGameGLTF('BirdSmall');
    const groupRef = useRef<Group>(null);
    const randomRef = useRef(createRandom(habitat.seed));
    const runtimeRef = useRef<BirdRuntimeState | null>(null);
    const flappingRef = useRef(false);
    const lastAnimalDebugUpdateRef = useRef(0);
    const lastDisturbanceSequenceRef = useRef(0);
    const [isFlapping, setIsFlapping] = useState(false);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const animalDisturbance = useGameState((state) => state.animalDisturbance);
    const setAnimalDebugEntry = useGameState(
        (state) => state.setAnimalDebugEntry,
    );
    const removeAnimalDebugEntry = useGameState(
        (state) => state.removeAnimalDebugEntry,
    );

    const birdModel = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse((object) => {
            if (isMesh(object)) {
                object.castShadow = true;
                object.receiveShadow = true;
                tintBirdPartMaterial(object);
            }
        });
        return {
            rig: {
                flightLegPoseAmount: 0,
                footLeft: getBirdRigNode(clone, 'BirdSmall_Foot_L'),
                footRight: getBirdRigNode(clone, 'BirdSmall_Foot_R'),
                groundPeckAmount: 0,
                groundPeckTargetAmount: 0,
                headPivot: getBirdRigNode(clone, 'BirdSmall_HeadPivot'),
                legPivotLeft: getBirdRigNode(clone, 'BirdSmall_LegPivot_L'),
                legPivotRight: getBirdRigNode(clone, 'BirdSmall_LegPivot_R'),
            } satisfies BirdRigParts,
            scene: clone,
        };
    }, [gltf.scene]);
    const { actions } = useAnimations(gltf.animations, birdModel.scene);

    useEffect(() => {
        const idleAction = actions.BirdSmall_Idle;
        const flapAction = actions.BirdSmall_Flap;

        if (isFlapping) {
            idleAction?.fadeOut(0.18);
            if (flapAction) {
                flapAction.timeScale = birdFlightFlapSpeed;
            }
            flapAction?.reset().fadeIn(0.12).play();
            return;
        }

        flapAction?.fadeOut(0.18);
        idleAction?.reset().fadeIn(0.2).play();
    }, [actions, isFlapping]);

    useEffect(() => {
        runtimeRef.current = null;
        if (groupRef.current) {
            groupRef.current.position.copy(habitat.home.position);
            if (habitat.home.facingYaw !== undefined) {
                groupRef.current.rotation.y = habitat.home.facingYaw;
            }
        }
    }, [habitat.home.facingYaw, habitat.home.position]);

    useEffect(() => {
        return () => removeAnimalDebugEntry(habitat.id);
    }, [habitat.id, removeAnimalDebugEntry]);

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }

        const now = clock.elapsedTime;
        const random = randomRef.current;
        let runtime = runtimeRef.current;

        const setFlapping = (next: boolean) => {
            if (flappingRef.current === next) {
                return;
            }
            flappingRef.current = next;
            setIsFlapping(next);
        };

        if (!runtime) {
            runtime = makeSettledState({
                now,
                random,
                target: habitat.home,
                timeOfDay,
            });
            runtimeRef.current = runtime;
            group.position.copy(habitat.home.position);
            if (habitat.home.facingYaw !== undefined) {
                group.rotation.y = habitat.home.facingYaw;
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
                isBirdDisturbanceRelevant({
                    disturbance: animalDisturbance,
                    group,
                    habitat,
                    runtime,
                })
            ) {
                const target = createAirTarget({
                    anchors: getAirAnchorsInRange(
                        habitat,
                        Math.max(
                            getBirdActivityRange(timeOfDay),
                            animalDisturbance.radius + 2,
                        ),
                    ),
                    home: habitat.home,
                    index: animalDisturbance.sequence,
                    random,
                });
                target.position.y = Math.max(
                    target.position.y,
                    animalDisturbance.position.y + 1.3,
                );
                runtime = makeMovingState({
                    from: group.position.clone(),
                    now,
                    random,
                    takeoffLead: false,
                    target,
                    timeOfDay,
                });
                runtimeRef.current = runtime;
            }
        }

        if (runtime.phase === 'circling') {
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            const nextPosition = circlePositionAt(runtime.target, progress);

            group.position.copy(nextPosition);
            facePosition(
                group,
                circleFacingPosition(runtime.target, progress),
                delta,
            );
            group.rotation.x = -0.08 + Math.sin(now * 9 + habitat.seed) * 0.035;
            group.rotation.z =
                (runtime.target.circle?.clockwise ?? 1) * 0.18 +
                Math.sin(now * 7 + habitat.seed) * 0.06;
            birdModel.rig.groundPeckTargetAmount = 0;
            setFlapping(updateFlightFlapping(runtime, now, random));

            if (progress < 1) {
                return;
            }

            const target = chooseNextTarget({
                currentTarget: runtime.target,
                habitat,
                random,
                timeOfDay,
            });
            runtimeRef.current = makeMovingState({
                from: group.position.clone(),
                now,
                random,
                takeoffLead: false,
                target,
                timeOfDay,
            });
            return;
        }

        if (runtime.phase === 'moving') {
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            const movementProgress =
                runtime.motion === 'fly'
                    ? flightProgressAt(runtime, progress)
                    : smoothProgress(progress);
            const nextPosition =
                runtime.motion === 'fly'
                    ? flightPositionAt(runtime, movementProgress)
                    : runtime.from.clone().lerp(runtime.to, movementProgress);

            if (runtime.motion === 'walk') {
                nextPosition.y +=
                    Math.max(
                        0,
                        Math.sin((now - runtime.startedAt) * Math.PI * 4),
                    ) * 0.025;
            }

            group.position.copy(nextPosition);
            facePosition(
                group,
                runtime.motion === 'fly'
                    ? flightPositionAt(
                          runtime,
                          flightProgressAt(
                              runtime,
                              MathUtils.clamp(
                                  progress + birdFlightLookAheadProgress,
                                  0,
                                  1,
                              ),
                          ),
                      )
                    : runtime.to,
                delta,
                runtime.motion === 'fly'
                    ? birdFlightTurnDamping
                    : defaultTurnDamping,
            );
            group.rotation.x =
                runtime.motion === 'fly'
                    ? -0.08 + Math.sin(now * 9 + habitat.seed) * 0.035
                    : 0;
            group.rotation.z =
                runtime.motion === 'fly'
                    ? Math.sin(now * 7 + habitat.seed) * 0.14
                    : Math.sin(now * 12 + habitat.seed) * 0.035;
            setFlapping(
                runtime.motion === 'fly'
                    ? updateFlightFlapping(runtime, now, random)
                    : false,
            );
            birdModel.rig.groundPeckTargetAmount = 0;

            if (progress < 1) {
                return;
            }

            group.position.copy(runtime.to);
            if (runtime.target.behavior === 'circle') {
                runtimeRef.current = makeCirclingState({
                    now,
                    random,
                    target: runtime.target,
                });
                return;
            }

            if (
                runtime.target.behavior === 'air' &&
                runtime.airUntil !== null &&
                now < runtime.airUntil
            ) {
                const airTarget = createAirTarget({
                    anchors: getAirAnchorsInRange(
                        habitat,
                        getBirdActivityRange(timeOfDay),
                    ),
                    home: habitat.home,
                    index: runtime.airWaypointIndex + 1,
                    random,
                });
                runtimeRef.current = makeMovingState({
                    airUntil: runtime.airUntil,
                    airWaypointIndex: runtime.airWaypointIndex + 1,
                    entryTangent: runtime.exitTangent,
                    from: runtime.to.clone(),
                    now,
                    random,
                    takeoffLead: false,
                    target: airTarget,
                    timeOfDay,
                });
                return;
            }

            const nextSettledTarget =
                runtime.target.behavior === 'air'
                    ? chooseNextTarget({
                          currentTarget: runtime.target,
                          habitat,
                          random,
                          timeOfDay,
                      })
                    : runtime.target;

            if (runtime.target.behavior === 'air') {
                runtimeRef.current = makeMovingState({
                    entryTangent: runtime.exitTangent,
                    from: runtime.to.clone(),
                    now,
                    random,
                    takeoffLead: false,
                    target: nextSettledTarget,
                    timeOfDay,
                });
                return;
            }

            runtimeRef.current = makeSettledState({
                now,
                random,
                target: runtime.target,
                timeOfDay,
            });
            setFlapping(false);
            return;
        }

        const groundForage =
            runtime.target.behavior === 'ground'
                ? updateGroundForage({ now, random, runtime })
                : null;
        birdModel.rig.groundPeckTargetAmount = groundForage?.peckAmount ?? 0;

        group.position.copy(runtime.target.position);
        if (groundForage) {
            group.position.add(groundForage.offset);
        } else {
            group.position.y += settledHopOffset({
                now,
                random,
                runtime,
                timeOfDay,
            });
        }
        group.rotation.x = 0;
        group.rotation.z =
            Math.sin(now * 2.5 + habitat.seed) *
            (groundForage?.peckAmount ? 0.045 : 0.025);
        if (groundForage?.facingTarget) {
            facePosition(group, groundForage.facingTarget, delta);
        } else if (runtime.target.facingYaw !== undefined) {
            faceYaw(group, runtime.target.facingYaw, delta);
        }
        setFlapping(false);

        if (now < runtime.dwellUntil) {
            return;
        }

        const target = chooseNextTarget({
            currentTarget: runtime.target,
            habitat,
            random,
            timeOfDay,
        });
        if (
            target.behavior !== 'air' &&
            target.behavior !== 'circle' &&
            group.position.distanceTo(target.position) < 0.08
        ) {
            runtimeRef.current = makeSettledState({
                now,
                random,
                target,
                timeOfDay,
            });
            return;
        }
        runtimeRef.current = makeMovingState({
            from: group.position.clone(),
            now,
            random,
            target,
            timeOfDay,
        });
    });

    useFrame(({ clock }, delta) => {
        const runtime = runtimeRef.current;
        const group = groupRef.current;
        const now = clock.elapsedTime;
        updateFlightLegPose({
            delta,
            flying:
                runtime?.phase === 'circling' ||
                (runtime?.phase === 'moving' && runtime.motion === 'fly'),
            now,
            rig: birdModel.rig,
            seed: habitat.seed,
        });
        updateGroundPeckPose({ delta, rig: birdModel.rig });

        if (runtime && group && now - lastAnimalDebugUpdateRef.current >= 0.5) {
            lastAnimalDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createBirdDebugEntry({ group, habitat, now, runtime }),
            );
        }
    });

    return (
        <group ref={groupRef} scale={birdScale}>
            <primitive object={birdModel.scene} />
        </group>
    );
}

export function Birds({ stacks }: { stacks: Stack[] | undefined }) {
    const { data: blockData } = useBlockData();
    const habitats = useMemo(
        () => createBirdHabitats(stacks, blockData),
        [blockData, stacks],
    );

    if (habitats.length <= 0) {
        return null;
    }

    return (
        <>
            {habitats.map((habitat) => (
                <Bird key={habitat.id} habitat={habitat} />
            ))}
        </>
    );
}
