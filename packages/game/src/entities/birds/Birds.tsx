import type { BlockData } from '@gredice/client';
import { useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Object3D } from 'three';
import { MathUtils, Mesh, Vector3 } from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import { useIsEditMode } from '../../hooks/useIsEditMode';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
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
    hopStartedAt: number | null;
    hopDuration: number;
    hopHeight: number;
    nextHopAt: number;
};

type BirdRuntimeState = MovingBirdState | CirclingBirdState | SettledBirdState;

const birdScale = 0.28;
const birdGroundLift = 0.02;
const birdHousePerchYOffset = 1.3;
const birdHouseEntranceYawOffset = Math.PI;
const birdFlightFlapLeadSeconds = 0.2;
const birdFlightFlapSpeed = 2.4;
const birdFlightSpeedBlocksPerSecond = 1.35;
const birdFlightTurnDamping = 3.4;
const birdFlightLookAheadProgress = 0.045;
const birdWalkSpeedBlocksPerSecond = 0.24;
const birdCircleSpeedBlocksPerSecond = 1.2;
const airMinHeight = 1.45;
const airHeightVariance = 1.05;
const airArcMaxHeight = 1;
const circleTallBlockMinPerchY = 0.9;
const circleHeightMaxAboveHome = 3.2;
const circleVerticalBobHeight = 0.16;
const defaultTurnDamping = 8;
const fullTurn = Math.PI * 2;

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
    Composter: 1.1,
    GardenBox: 0.75,
    Raised_Bed: 1.05,
    Shade: 1.25,
    ShovelSmall: 0.18,
    Snowman: 0.95,
    StoneLarge: 0.5,
    StoneMedium: 0.35,
    StoneSmall: 0.22,
    Stool: 0.52,
    Tulip: 0.5,
    BaleHey: 0.5,
    PotLowBowl: 0.56,
    PotRoundedBowl: 0.66,
    PotBulbousNeck: 0.78,
    PotTallTapered: 0.82,
    PotHourglass: 0.78,
    PotStraightShortTub: 0.66,
    PotNarrowFootBowl: 0.7,
    PotSquatRidged: 0.66,
    PotTallSlenderCone: 0.86,
    PotWideLippedCup: 0.7,
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
        ? birdFlightSpeedBlocksPerSecond * 0.78
        : birdFlightSpeedBlocksPerSecond;
    return MathUtils.clamp(distance / speed, 1.25, 8.5);
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
    timeOfDay,
}: {
    airUntil?: number | null;
    airWaypointIndex?: number;
    entryTangent?: Vector3;
    from: Vector3;
    now: number;
    random: () => number;
    target: BirdTarget;
    timeOfDay: number;
}) {
    const motion: BirdMotion =
        from.distanceTo(target.position) <= 2.2 && target.behavior === 'ground'
            ? 'walk'
            : 'fly';
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

    return {
        phase: 'moving',
        target,
        entryTangent: nextEntryTangent,
        exitTangent: nextExitTangent,
        from,
        to: target.position.clone(),
        startedAt: now + (motion === 'fly' ? birdFlightFlapLeadSeconds : 0),
        duration: movementDuration(from, target.position, motion, timeOfDay),
        motion,
        airUntil: nextAirUntil,
        airWaypointIndex,
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

function isMesh(object: Object3D): object is Mesh {
    return object instanceof Mesh;
}

function Bird({ habitat }: { habitat: BirdHabitat }) {
    const gltf = useGameGLTF('BirdSmall');
    const groupRef = useRef<Group>(null);
    const randomRef = useRef(createRandom(habitat.seed));
    const runtimeRef = useRef<BirdRuntimeState | null>(null);
    const flappingRef = useRef(false);
    const [isFlapping, setIsFlapping] = useState(false);
    const timeOfDay = useGameState((state) => state.timeOfDay);

    const birdScene = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse((object) => {
            if (isMesh(object)) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });
        return clone;
    }, [gltf.scene]);
    const { actions } = useAnimations(gltf.animations, birdScene);

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
            const nextPosition =
                runtime.motion === 'fly'
                    ? flightPositionAt(runtime, progress)
                    : runtime.from
                          .clone()
                          .lerp(runtime.to, smoothProgress(progress));

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
                          MathUtils.clamp(
                              progress + birdFlightLookAheadProgress,
                              0,
                              1,
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

        group.position.copy(runtime.target.position);
        group.position.y += settledHopOffset({
            now,
            random,
            runtime,
            timeOfDay,
        });
        group.rotation.x = 0;
        group.rotation.z = Math.sin(now * 2.5 + habitat.seed) * 0.025;
        if (runtime.target.facingYaw !== undefined) {
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

    return (
        <group ref={groupRef} scale={birdScale}>
            <primitive object={birdScene} />
        </group>
    );
}

export function Birds({ stacks }: { stacks: Stack[] | undefined }) {
    const { data: blockData } = useBlockData();
    const isEditMode = useIsEditMode();
    const habitats = useMemo(
        () => createBirdHabitats(stacks, blockData),
        [blockData, stacks],
    );

    if (isEditMode || habitats.length <= 0) {
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
