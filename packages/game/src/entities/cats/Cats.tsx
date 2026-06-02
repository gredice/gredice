import type { BlockData } from '@gredice/client';
import { useAnimations } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationAction, Group, Material, Object3D } from 'three';
import { MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { useGameFlags } from '../../GameFlagsContext';
import { useBlockData } from '../../hooks/useBlockData';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
    type GameState,
    useGameState,
} from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import {
    type CatBehavior,
    type CatWeather,
    getCatActivityRange,
    getCatDwellSeconds,
    isCatNight,
    pickCatBehavior,
    shouldCatSeekCover,
} from './catBehavior';
import {
    type CatPathCell,
    type CatPathResult,
    type CatPathSurface,
    findCatPath,
} from './catPathfinding';

type CatWeatherOverride = Partial<NonNullable<GameState['weather']>>;

type CatTarget = {
    id: string;
    behavior: CatBehavior;
    facingYaw?: number;
    lookAtPosition?: Vector3;
    position: Vector3;
    walkPosition?: Vector3;
};

type CatGroundSurface = CatPathSurface;

type CatHabitat = {
    id: string;
    blockedCells: CatPathCell[];
    covers: CatTarget[];
    groundSurfaces: CatGroundSurface[];
    lowEntities: CatTarget[];
    pillow: CatTarget;
    roamAnchors: CatTarget[];
    seed: number;
};

type MovingCatState = {
    phase: 'moving';
    duration: number;
    from: Vector3;
    groundSurfaces: CatGroundSurface[];
    path: Vector3[];
    pathDistance: number;
    pathfinding: CatPathResult;
    startedAt: number;
    target: CatTarget;
    to: Vector3;
};

type SettledCatState = {
    phase: 'settled';
    dwellUntil: number;
    target: CatTarget;
};

type CatRuntimeState = MovingCatState | SettledCatState;

type CatAnimationName =
    | 'Cat_Idle'
    | 'Cat_Walk'
    | 'Cat_LyingIdle'
    | 'Cat_PreyWatch';

const catDebugBehaviors = [
    'pillow',
    'roam',
    'cover',
    'low-entity',
    'stalk-bird',
] satisfies CatBehavior[];

const clearCatWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
} satisfies CatWeather;

const catScale = 0.42;
const catGroundLift = 0.02;
const catPillowSurfaceYOffset = 0.24;
const catGroundSurfaceHalfSize = 0.5;
const catGroundSurfaceEpsilon = 0.001;
const catWalkSpeedBlocksPerSecond = 0.75;
const catWalkCycleDistance = 0.9;
const catWalkAnimationFallbackDuration = 4 / 3;
const catWalkAnimationMinTimeScale = 0.25;
const catWalkAnimationMaxTimeScale = 1.45;
const catWalkBodyBobHeight = 0.012;
const catWalkTurnDamping = 7.5;
const catIdleTurnDamping = 8.5;
const catWalkLookAheadProgress = 0.05;
const fullTurn = Math.PI * 2;
const catDarkFurColor = '#2f3437';
const catSoftDarkFurColor = '#3b4144';

const catPillowBlockNames = new Set(['CatPillow', 'Cat_Pillow']);
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

const lowEntityYOffsets: Record<string, number> = {
    BaleHey: 0.5,
    Bucket: 0.56,
    Bush: 0.5,
    Composter: 0.62,
    DesertStoneMedium: 0.35,
    DesertStoneSmall: 0.22,
    PotBulbousNeck: 0.51,
    PotHourglass: 0.47,
    PotLowBowl: 0.26,
    PotNarrowFootBowl: 0.39,
    PotRoundedBowl: 0.43,
    PotSquatRidged: 0.42,
    PotStraightShortTub: 0.4,
    PotTallSlenderCone: 0.62,
    PotTallTapered: 0.54,
    PotWideLippedCup: 0.49,
    StoneMedium: 0.35,
    StoneSmall: 0.22,
    Stool: 0.52,
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

function horizontalDistance(left: Vector3, right: Vector3) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function getCatGroundYFromHeight(height: number) {
    return height > 0 ? height + catGroundLift : 0;
}

function getCatWalkYAt(
    position: Pick<Vector3, 'x' | 'z'>,
    groundSurfaces: CatGroundSurface[],
) {
    let surfaceY: number | null = null;

    for (const surface of groundSurfaces) {
        const insideSurface =
            Math.abs(position.x - surface.x) <=
                catGroundSurfaceHalfSize + catGroundSurfaceEpsilon &&
            Math.abs(position.z - surface.z) <=
                catGroundSurfaceHalfSize + catGroundSurfaceEpsilon;

        if (insideSurface && (surfaceY === null || surface.y > surfaceY)) {
            surfaceY = surface.y;
        }
    }

    return surfaceY ?? 0;
}

function getTargetWalkPosition(target: CatTarget) {
    return (target.walkPosition ?? target.position).clone();
}

function candidatesInRange<T extends { position: Vector3 }>(
    candidates: T[],
    home: CatTarget,
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
    return rotation * (Math.PI / 2) + Math.PI;
}

function isCatPillowBlockName(name: string) {
    return catPillowBlockNames.has(name);
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

function getLowEntityYOffset(
    blockData: BlockData[] | null | undefined,
    blockName: string,
) {
    const configuredOffset = lowEntityYOffsets[blockName];
    if (configuredOffset !== undefined) {
        return configuredOffset;
    }

    const blockHeight = getBlockHeight(blockData, blockName);
    if (blockHeight !== null && blockHeight >= 0.18 && blockHeight <= 0.68) {
        return blockHeight;
    }

    return null;
}

function getGroundSurfaceY(
    blockData: BlockData[] | null | undefined,
    stack: Stack,
) {
    let height = 0;
    let hasGroundBlock = false;

    for (const block of stack.blocks) {
        if (!isGroundBlockName(block.name)) {
            break;
        }

        hasGroundBlock = true;
        height += getBlockHeight(blockData, block.name) ?? 0;
    }

    return hasGroundBlock ? getCatGroundYFromHeight(height) : null;
}

function createCatGroundSurfaces(
    stacks: Stack[] | undefined,
    blockData: BlockData[] | null | undefined,
) {
    const surfaces: CatGroundSurface[] = [];

    for (const stack of stacks ?? []) {
        const y = getGroundSurfaceY(blockData, stack);
        if (y === null) {
            continue;
        }

        surfaces.push({
            x: stack.position.x,
            y,
            z: stack.position.z,
        });
    }

    return surfaces;
}

function createCatBlockedCells(stacks: Stack[] | undefined) {
    const blockedCells: CatPathCell[] = [];

    for (const stack of stacks ?? []) {
        const topBlock = stack.blocks.at(-1);
        if (!topBlock || isGroundBlockName(topBlock.name)) {
            continue;
        }

        blockedCells.push({
            x: Math.round(stack.position.x),
            z: Math.round(stack.position.z),
        });
    }

    return blockedCells;
}

function targetForPillowBlock({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const stackHeight = getStackHeight(blockData, stack, block);
    const pillowSurfaceHeight = Math.min(
        getBlockHeight(blockData, block.name) ?? catPillowSurfaceYOffset,
        catPillowSurfaceYOffset,
    );

    return {
        behavior: 'pillow',
        facingYaw: blockRotationToYaw(block.rotation),
        id: `pillow-${block.id}`,
        position: new Vector3(
            stack.position.x,
            stackHeight + pillowSurfaceHeight + catGroundLift,
            stack.position.z,
        ),
        walkPosition: new Vector3(
            stack.position.x,
            getCatGroundYFromHeight(stackHeight),
            stack.position.z,
        ),
    } satisfies CatTarget;
}

function targetForGroundStack(
    stack: Stack,
    blockData: BlockData[] | null | undefined,
) {
    const position = new Vector3(
        stack.position.x,
        getCatGroundYFromHeight(getStackHeight(blockData, stack)),
        stack.position.z,
    );

    return {
        behavior: 'roam',
        id: `roam-${stack.position.x}-${stack.position.z}`,
        position,
        walkPosition: position.clone(),
    } satisfies CatTarget;
}

function targetForCoverBlock({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const seed = hashString(block.id);
    const angle = (seed / 4294967296) * fullTurn;
    const radius = 0.26 + ((seed >>> 5) % 9) * 0.012;
    const x = stack.position.x + Math.cos(angle) * radius;
    const z = stack.position.z + Math.sin(angle) * radius;
    const y = getCatGroundYFromHeight(getStackHeight(blockData, stack, block));
    const position = new Vector3(x, y, z);

    return {
        behavior: 'cover',
        facingYaw: Math.atan2(stack.position.x - x, stack.position.z - z),
        id: `cover-${block.id}`,
        position,
        walkPosition: position.clone(),
    } satisfies CatTarget;
}

function targetForLowEntityBlock({
    block,
    blockData,
    stack,
    yOffset,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
    yOffset: number;
}) {
    const stackHeight = getStackHeight(blockData, stack, block);

    return {
        behavior: 'low-entity',
        facingYaw: blockRotationToYaw(block.rotation),
        id: `low-entity-${block.id}`,
        position: new Vector3(
            stack.position.x,
            stackHeight + yOffset + catGroundLift,
            stack.position.z,
        ),
        walkPosition: new Vector3(
            stack.position.x,
            getCatGroundYFromHeight(stackHeight),
            stack.position.z,
        ),
    } satisfies CatTarget;
}

function createCatHabitats(
    stacks: Stack[] | undefined,
    blockData: BlockData[] | null | undefined,
) {
    const blockedCells = createCatBlockedCells(stacks);
    const groundSurfaces = createCatGroundSurfaces(stacks, blockData);
    const pillows: CatTarget[] = [];
    const covers: CatTarget[] = [];
    const lowEntities: CatTarget[] = [];
    const roamAnchors: CatTarget[] = [];

    for (const stack of stacks ?? []) {
        for (const block of stack.blocks) {
            if (isCatPillowBlockName(block.name)) {
                pillows.push(targetForPillowBlock({ block, blockData, stack }));
            }
        }

        const topBlock = stack.blocks.at(-1);
        if (!topBlock) {
            continue;
        }

        if (isTreeBlockName(topBlock.name)) {
            covers.push(
                targetForCoverBlock({ block: topBlock, blockData, stack }),
            );
            continue;
        }

        if (stack.blocks.length === 1 && isGroundBlockName(topBlock.name)) {
            roamAnchors.push(targetForGroundStack(stack, blockData));
            continue;
        }

        if (
            !isCatPillowBlockName(topBlock.name) &&
            !isGroundBlockName(topBlock.name)
        ) {
            const yOffset = getLowEntityYOffset(blockData, topBlock.name);
            if (yOffset !== null) {
                lowEntities.push(
                    targetForLowEntityBlock({
                        block: topBlock,
                        blockData,
                        stack,
                        yOffset,
                    }),
                );
            }
        }
    }

    return pillows.map((pillow) => ({
        id: `cat-${pillow.id}`,
        blockedCells,
        covers,
        groundSurfaces,
        lowEntities,
        pillow,
        roamAnchors,
        seed: hashString(pillow.id),
    }));
}

function movementDuration(distance: number) {
    return MathUtils.clamp(distance / catWalkSpeedBlocksPerSecond, 0.9, 8.5);
}

function movingCatHorizontalSpeed(runtime: MovingCatState) {
    if (runtime.duration <= 0) {
        return 0;
    }

    return runtime.pathDistance / runtime.duration;
}

function pathHorizontalDistance(path: Vector3[]) {
    let distance = 0;
    for (let index = 1; index < path.length; index += 1) {
        const previous = path[index - 1];
        const current = path[index];
        if (!previous || !current) {
            continue;
        }
        distance += horizontalDistance(previous, current);
    }
    return distance;
}

function vectorFromPathPoint(point: CatPathSurface) {
    return new Vector3(point.x, point.y, point.z);
}

function vectorPathFromResult(pathfinding: CatPathResult) {
    return pathfinding.points.map(vectorFromPathPoint);
}

function pathPositionAtDistance(path: Vector3[], distance: number) {
    if (path.length <= 0) {
        return new Vector3();
    }

    const firstPoint = path[0];
    if (!firstPoint || distance <= 0) {
        return firstPoint?.clone() ?? new Vector3();
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

    return path[path.length - 1]?.clone() ?? new Vector3();
}

function catWalkAnimationTimeScale(
    runtime: CatRuntimeState | null,
    action: AnimationAction | null | undefined,
) {
    if (runtime?.phase !== 'moving') {
        return 1;
    }

    const clipDuration =
        action?.getClip().duration ?? catWalkAnimationFallbackDuration;
    const speed = movingCatHorizontalSpeed(runtime);

    return MathUtils.clamp(
        (speed * clipDuration) / catWalkCycleDistance,
        catWalkAnimationMinTimeScale,
        catWalkAnimationMaxTimeScale,
    );
}

function faceYaw(
    group: Group,
    targetYaw: number,
    delta: number,
    turnDamping = catIdleTurnDamping,
) {
    const difference =
        MathUtils.euclideanModulo(
            targetYaw - group.rotation.y + Math.PI,
            fullTurn,
        ) - Math.PI;
    const turnAmount = 1 - Math.exp(-turnDamping * delta);
    group.rotation.y += difference * turnAmount;
}

function facePosition(
    group: Group,
    target: Vector3,
    delta: number,
    turnDamping = catIdleTurnDamping,
) {
    const directionX = target.x - group.position.x;
    const directionZ = target.z - group.position.z;
    if (Math.hypot(directionX, directionZ) <= 0.001) {
        return;
    }

    faceYaw(group, Math.atan2(directionX, directionZ), delta, turnDamping);
}

function createRoamTarget({
    habitat,
    random,
    range,
}: {
    habitat: CatHabitat;
    random: () => number;
    range: number;
}) {
    const anchors = candidatesInRange(
        habitat.roamAnchors,
        habitat.pillow,
        range,
    );
    const anchor = pickCandidate(anchors, random) ?? habitat.pillow;
    const anchorWalkPosition = getTargetWalkPosition(anchor);
    const radius = anchor === habitat.pillow ? 0.28 : 0.16 + random() * 0.18;
    const angle = random() * fullTurn;
    const position = new Vector3(
        anchorWalkPosition.x + Math.cos(angle) * radius,
        anchorWalkPosition.y,
        anchorWalkPosition.z + Math.sin(angle) * radius,
    );

    return {
        behavior: 'roam',
        facingYaw: angle,
        id: `roam-${anchor.id}-${Math.round(angle * 1000)}`,
        position,
        walkPosition: position.clone(),
    } satisfies CatTarget;
}

function getGroundBirdTargets({
    birdGroundEntries,
    habitat,
    range,
}: {
    birdGroundEntries: AnimalDebugEntry[];
    habitat: CatHabitat;
    range: number;
}) {
    return birdGroundEntries.filter((entry) => {
        const position = new Vector3(
            entry.position.x,
            entry.position.y,
            entry.position.z,
        );
        return horizontalDistance(position, habitat.pillow.position) <= range;
    });
}

function createStalkBirdTarget({
    birdGroundTargets,
    habitat,
    random,
}: {
    birdGroundTargets: AnimalDebugEntry[];
    habitat: CatHabitat;
    random: () => number;
}) {
    const targetBird = pickCandidate(birdGroundTargets, random);
    if (!targetBird) {
        return null;
    }

    const birdPosition = new Vector3(
        targetBird.position.x,
        targetBird.position.y,
        targetBird.position.z,
    );
    const approach = habitat.pillow.position.clone().sub(birdPosition);
    if (approach.lengthSq() <= 0.001) {
        const angle = random() * fullTurn;
        approach.set(Math.cos(angle), 0, Math.sin(angle));
    }
    approach.y = 0;
    approach.setLength(0.5 + random() * 0.18);

    const position = birdPosition.clone().add(approach);
    position.y = getCatWalkYAt(position, habitat.groundSurfaces);

    return {
        behavior: 'stalk-bird',
        facingYaw: Math.atan2(
            birdPosition.x - position.x,
            birdPosition.z - position.z,
        ),
        id: `stalk-bird-${targetBird.id}`,
        lookAtPosition: birdPosition,
        position,
        walkPosition: position.clone(),
    } satisfies CatTarget;
}

function chooseNextTarget({
    birdGroundEntries,
    habitat,
    random,
    timeOfDay,
    weather,
}: {
    birdGroundEntries: AnimalDebugEntry[];
    habitat: CatHabitat;
    random: () => number;
    timeOfDay: number;
    weather: CatWeather | null | undefined;
}) {
    const range = getCatActivityRange(timeOfDay, weather);
    const covers = candidatesInRange(habitat.covers, habitat.pillow, range);
    const lowEntities = candidatesInRange(
        habitat.lowEntities,
        habitat.pillow,
        range,
    );
    const roamAnchors = candidatesInRange(
        habitat.roamAnchors,
        habitat.pillow,
        range,
    );
    const birdGroundTargets = getGroundBirdTargets({
        birdGroundEntries,
        habitat,
        range,
    });
    const behavior = pickCatBehavior({
        availability: {
            cover: covers.length > 0,
            'low-entity': lowEntities.length > 0,
            roam: roamAnchors.length > 0,
            'stalk-bird': birdGroundTargets.length > 0,
        },
        random,
        timeOfDay,
        weather,
    });

    if (behavior === 'cover') {
        return pickCandidate(covers, random) ?? habitat.pillow;
    }

    if (behavior === 'stalk-bird') {
        return (
            createStalkBirdTarget({ birdGroundTargets, habitat, random }) ??
            habitat.pillow
        );
    }

    if (behavior === 'low-entity') {
        return pickCandidate(lowEntities, random) ?? habitat.pillow;
    }

    if (behavior === 'roam') {
        return createRoamTarget({ habitat, random, range });
    }

    return habitat.pillow;
}

function chooseManualNextTarget({
    birdGroundEntries,
    currentTarget,
    habitat,
    random,
    timeOfDay,
    weather,
}: {
    birdGroundEntries: AnimalDebugEntry[];
    currentTarget: CatTarget;
    habitat: CatHabitat;
    random: () => number;
    timeOfDay: number;
    weather: CatWeather | null | undefined;
}) {
    const target = chooseNextTarget({
        birdGroundEntries,
        habitat,
        random,
        timeOfDay,
        weather,
    });
    const canManuallyReturnToPillow =
        isCatNight(timeOfDay) || shouldCatSeekCover(timeOfDay, weather);

    if (
        (target.id !== currentTarget.id ||
            target.behavior !== currentTarget.behavior) &&
        (target.behavior !== 'pillow' || canManuallyReturnToPillow)
    ) {
        return target;
    }

    const range = getCatActivityRange(timeOfDay, weather);
    const covers = candidatesInRange(habitat.covers, habitat.pillow, range);
    const lowEntities = candidatesInRange(
        habitat.lowEntities,
        habitat.pillow,
        range,
    );
    const roamAnchors = candidatesInRange(
        habitat.roamAnchors,
        habitat.pillow,
        range,
    );
    const birdGroundTargets = getGroundBirdTargets({
        birdGroundEntries,
        habitat,
        range,
    });
    const alternatives: CatTarget[] = [];

    if (currentTarget.behavior !== 'roam' && roamAnchors.length > 0) {
        alternatives.push(createRoamTarget({ habitat, random, range }));
    }

    if (currentTarget.behavior !== 'cover') {
        alternatives.push(...covers);
    }

    if (currentTarget.behavior !== 'stalk-bird') {
        const stalkTarget = createStalkBirdTarget({
            birdGroundTargets,
            habitat,
            random,
        });
        if (stalkTarget) {
            alternatives.push(stalkTarget);
        }
    }

    if (currentTarget.behavior !== 'low-entity') {
        alternatives.push(...lowEntities);
    }

    if (currentTarget.behavior !== 'pillow' && canManuallyReturnToPillow) {
        alternatives.push(habitat.pillow);
    }

    return pickCandidate(alternatives, random) ?? target;
}

function chooseDebugTarget({
    behavior,
    birdGroundEntries,
    habitat,
    random,
    timeOfDay,
    weather,
}: {
    behavior: string;
    birdGroundEntries: AnimalDebugEntry[];
    habitat: CatHabitat;
    random: () => number;
    timeOfDay: number;
    weather: CatWeather | null | undefined;
}) {
    const range = getCatActivityRange(timeOfDay, weather);

    if (behavior === 'pillow') {
        return habitat.pillow;
    }

    if (behavior === 'roam') {
        return createRoamTarget({ habitat, random, range });
    }

    if (behavior === 'cover') {
        return (
            pickCandidate(
                candidatesInRange(habitat.covers, habitat.pillow, range),
                random,
            ) ?? habitat.pillow
        );
    }

    if (behavior === 'low-entity') {
        return (
            pickCandidate(
                candidatesInRange(habitat.lowEntities, habitat.pillow, range),
                random,
            ) ?? habitat.pillow
        );
    }

    if (behavior === 'stalk-bird') {
        return (
            createStalkBirdTarget({
                birdGroundTargets: getGroundBirdTargets({
                    birdGroundEntries,
                    habitat,
                    range,
                }),
                habitat,
                random,
            }) ?? habitat.pillow
        );
    }

    return null;
}

function makeMovingState({
    blockedCells,
    from,
    fromTarget,
    groundSurfaces,
    now,
    target,
}: {
    blockedCells?: CatPathCell[];
    from: Vector3;
    fromTarget?: CatTarget;
    groundSurfaces?: CatGroundSurface[];
    now: number;
    target: CatTarget;
}) {
    const walkFrom = fromTarget
        ? getTargetWalkPosition(fromTarget)
        : from.clone();
    const walkTo = getTargetWalkPosition(target);
    const resolvedGroundSurfaces = groundSurfaces ?? [];
    if (groundSurfaces) {
        walkFrom.y = getCatWalkYAt(walkFrom, groundSurfaces);
        walkTo.y = getCatWalkYAt(walkTo, groundSurfaces);
    }

    const pathfinding = findCatPath({
        blockedCells: blockedCells ?? [],
        from: walkFrom,
        surfaces: resolvedGroundSurfaces,
        to: walkTo,
    });
    const path = vectorPathFromResult(pathfinding);
    const pathDistance = Math.max(
        pathfinding.distance,
        pathHorizontalDistance(path),
    );

    return {
        phase: 'moving',
        duration: movementDuration(pathDistance),
        from: walkFrom,
        groundSurfaces: resolvedGroundSurfaces,
        path,
        pathDistance,
        pathfinding,
        startedAt: now,
        target,
        to: walkTo,
    } satisfies MovingCatState;
}

function movingPositionAt(runtime: MovingCatState, progress: number) {
    const walkDistance = runtime.pathDistance * progress;
    const position = pathPositionAtDistance(runtime.path, walkDistance);
    const walkPhase = (walkDistance / catWalkCycleDistance) * fullTurn;

    position.y = getCatWalkYAt(position, runtime.groundSurfaces);
    position.y += Math.max(0, Math.sin(walkPhase * 2)) * catWalkBodyBobHeight;

    return position;
}

function makeSettledState({
    now,
    random,
    target,
    timeOfDay,
    weather,
}: {
    now: number;
    random: () => number;
    target: CatTarget;
    timeOfDay: number;
    weather: CatWeather | null | undefined;
}) {
    return {
        phase: 'settled',
        dwellUntil:
            now +
            getCatDwellSeconds({
                behavior: target.behavior,
                random,
                timeOfDay,
                weather,
            }),
        target,
    } satisfies SettledCatState;
}

function getCatAnimationName(runtime: CatRuntimeState): CatAnimationName {
    if (runtime.phase === 'moving') {
        return 'Cat_Walk';
    }

    if (
        runtime.target.behavior === 'pillow' ||
        runtime.target.behavior === 'cover'
    ) {
        return 'Cat_LyingIdle';
    }

    if (runtime.target.behavior === 'stalk-bird') {
        return 'Cat_PreyWatch';
    }

    return 'Cat_Idle';
}

function isMesh(object: Object3D): object is Mesh {
    return object instanceof Mesh;
}

function getCatDebugActivity(runtime: CatRuntimeState) {
    if (runtime.phase === 'moving') {
        return `walking to ${runtime.target.behavior}`;
    }

    if (runtime.target.behavior === 'pillow') {
        return 'napping on pillow';
    }

    if (runtime.target.behavior === 'cover') {
        return 'resting under cover';
    }

    if (runtime.target.behavior === 'stalk-bird') {
        return 'watching ground birds';
    }

    if (runtime.target.behavior === 'low-entity') {
        return 'perched on block';
    }

    return 'roaming';
}

function roundCatDebugCoordinate(value: number) {
    return Math.round(value * 100) / 100;
}

function roundCatDebugPoint(point: Vector3) {
    return {
        x: roundCatDebugCoordinate(point.x),
        y: roundCatDebugCoordinate(point.y),
        z: roundCatDebugCoordinate(point.z),
    };
}

function nextPathWaypoint(runtime: MovingCatState, position: Vector3) {
    return (
        runtime.path.find(
            (point) => horizontalDistance(point, position) > 0.12,
        ) ?? runtime.to
    );
}

function createCatDebugEntry({
    group,
    habitat,
    now,
    runtime,
}: {
    group: Group;
    habitat: CatHabitat;
    now: number;
    runtime: CatRuntimeState;
}): AnimalDebugEntry {
    return {
        id: habitat.id,
        species: 'Cat',
        label: habitat.pillow.id.replace(/^pillow-/, ''),
        phase: runtime.phase,
        behavior: runtime.target.behavior,
        activity: getCatDebugActivity(runtime),
        targetId: runtime.target.id,
        debugBehaviors: catDebugBehaviors,
        pathfinding:
            runtime.phase === 'moving'
                ? {
                      blockedCellCount: runtime.pathfinding.blockedCellCount,
                      distance: roundCatDebugCoordinate(runtime.pathDistance),
                      nextWaypoint: roundCatDebugPoint(
                          nextPathWaypoint(runtime, group.position),
                      ),
                      status: runtime.pathfinding.status,
                      targetCell: runtime.pathfinding.targetCell,
                      visitedCellCount: runtime.pathfinding.visitedCellCount,
                      waypointCount: runtime.path.length,
                  }
                : undefined,
        position: roundCatDebugPoint(group.position),
        updatedAt: now,
    };
}

function getCatMaterialTint(materialName: string) {
    if (materialName.includes('Material.Cat.BlackFurSoft')) {
        return catSoftDarkFurColor;
    }

    if (materialName.includes('Material.Cat.BlackFur')) {
        return catDarkFurColor;
    }

    return null;
}

function cloneCatMaterial(material: Material) {
    const clone = material.clone();
    const tint = getCatMaterialTint(material.name);

    if (tint && clone instanceof MeshStandardMaterial) {
        clone.color.set(tint);
        clone.metalness = 0;
        clone.roughness = Math.max(clone.roughness, 0.82);
    }

    return clone;
}

function prepareCatMesh(object: Mesh) {
    object.castShadow = true;
    object.frustumCulled = false;
    object.receiveShadow = true;
    object.material = Array.isArray(object.material)
        ? object.material.map(cloneCatMaterial)
        : cloneCatMaterial(object.material);
}

function Cat({
    birdGroundEntries,
    habitat,
    weather,
}: {
    birdGroundEntries: AnimalDebugEntry[];
    habitat: CatHabitat;
    weather: CatWeather | null | undefined;
}) {
    const gltf = useGameGLTF('Cat');
    const { enableDebugHudFlag = false } = useGameFlags();
    const clock = useThree((state) => state.clock);
    const groupRef = useRef<Group>(null);
    const randomRef = useRef(createRandom(habitat.seed));
    const runtimeRef = useRef<CatRuntimeState | null>(null);
    const lastAnimalDebugUpdateRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const activeAnimationRef = useRef<CatAnimationName>('Cat_LyingIdle');
    const [activeAnimation, setActiveAnimation] =
        useState<CatAnimationName>('Cat_LyingIdle');
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const animalDebugCommand = useGameState(
        (state) => state.animalDebugCommand,
    );
    const setAnimalDebugEntry = useGameState(
        (state) => state.setAnimalDebugEntry,
    );
    const removeAnimalDebugEntry = useGameState(
        (state) => state.removeAnimalDebugEntry,
    );

    const catModel = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse((object) => {
            if (isMesh(object)) {
                prepareCatMesh(object);
            }
        });
        return clone;
    }, [gltf.scene]);
    const { actions } = useAnimations(gltf.animations, catModel);

    useEffect(() => {
        const action = actions[activeAnimation];
        if (!action) {
            return;
        }

        action.timeScale =
            activeAnimation === 'Cat_Walk'
                ? catWalkAnimationTimeScale(runtimeRef.current, action)
                : 1;
        action.reset().fadeIn(0.18).play();
        return () => {
            action.fadeOut(0.18);
        };
    }, [actions, activeAnimation]);

    useEffect(() => {
        runtimeRef.current = null;
        if (groupRef.current) {
            groupRef.current.position.copy(habitat.pillow.position);
            if (habitat.pillow.facingYaw !== undefined) {
                groupRef.current.rotation.y = habitat.pillow.facingYaw;
            }
        }
    }, [habitat.pillow.facingYaw, habitat.pillow.position]);

    useEffect(() => {
        if (!enableDebugHudFlag) {
            removeAnimalDebugEntry(habitat.id);
        }

        return () => removeAnimalDebugEntry(habitat.id);
    }, [enableDebugHudFlag, habitat.id, removeAnimalDebugEntry]);

    function handlePointerDown(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
    }

    function handleClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();

        const group = groupRef.current;
        const runtime = runtimeRef.current;
        if (!group || !runtime) {
            return;
        }

        const random = randomRef.current;
        const now = clock.getElapsedTime();
        const target = chooseManualNextTarget({
            birdGroundEntries,
            currentTarget: runtime.target,
            habitat,
            random,
            timeOfDay,
            weather,
        });

        if (group.position.distanceTo(target.position) < 0.08) {
            runtimeRef.current = makeSettledState({
                now,
                random,
                target,
                timeOfDay,
                weather,
            });
            return;
        }

        runtimeRef.current = makeMovingState({
            blockedCells: habitat.blockedCells,
            from: group.position.clone(),
            fromTarget:
                runtime.phase === 'settled' ? runtime.target : undefined,
            groundSurfaces: habitat.groundSurfaces,
            now,
            target,
        });
    }

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }

        const now = clock.elapsedTime;
        const random = randomRef.current;
        let runtime = runtimeRef.current;

        const setAnimation = (nextAnimation: CatAnimationName) => {
            if (activeAnimationRef.current === nextAnimation) {
                return;
            }
            activeAnimationRef.current = nextAnimation;
            setActiveAnimation(nextAnimation);
        };
        const syncWalkAnimationSpeed = (nextRuntime: CatRuntimeState) => {
            const walkAction = actions.Cat_Walk;
            if (walkAction) {
                walkAction.timeScale = catWalkAnimationTimeScale(
                    nextRuntime,
                    walkAction,
                );
            }
        };

        if (!runtime) {
            runtime = makeSettledState({
                now,
                random,
                target: habitat.pillow,
                timeOfDay,
                weather,
            });
            runtimeRef.current = runtime;
            group.position.copy(habitat.pillow.position);
            if (habitat.pillow.facingYaw !== undefined) {
                group.rotation.y = habitat.pillow.facingYaw;
            }
        }

        if (
            animalDebugCommand &&
            animalDebugCommand.sequence !==
                lastDebugCommandSequenceRef.current &&
            animalDebugCommand.species === 'Cat'
        ) {
            lastDebugCommandSequenceRef.current = animalDebugCommand.sequence;

            if (
                !animalDebugCommand.targetId ||
                animalDebugCommand.targetId === habitat.id
            ) {
                const target = chooseDebugTarget({
                    behavior: animalDebugCommand.behavior,
                    birdGroundEntries,
                    habitat,
                    random,
                    timeOfDay,
                    weather,
                });

                if (target) {
                    runtime =
                        group.position.distanceTo(target.position) < 0.08
                            ? makeSettledState({
                                  now,
                                  random,
                                  target,
                                  timeOfDay,
                                  weather,
                              })
                            : makeMovingState({
                                  blockedCells: habitat.blockedCells,
                                  from: group.position.clone(),
                                  fromTarget:
                                      runtime.phase === 'settled'
                                          ? runtime.target
                                          : undefined,
                                  groundSurfaces: habitat.groundSurfaces,
                                  now,
                                  target,
                              });
                    runtimeRef.current = runtime;
                }
            }
        }

        if (runtime.phase === 'moving') {
            setAnimation(getCatAnimationName(runtime));
            syncWalkAnimationSpeed(runtime);
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            const nextPosition = movingPositionAt(runtime, progress);

            group.position.copy(nextPosition);
            facePosition(
                group,
                movingPositionAt(
                    runtime,
                    MathUtils.clamp(progress + catWalkLookAheadProgress, 0, 1),
                ),
                delta,
                catWalkTurnDamping,
            );
            group.rotation.x = 0;
            group.rotation.z = Math.sin(now * 8 + habitat.seed) * 0.018;

            if (progress < 1) {
                return;
            }

            group.position.copy(runtime.to);
            runtimeRef.current = makeSettledState({
                now,
                random,
                target: runtime.target,
                timeOfDay,
                weather,
            });
            return;
        }

        setAnimation(getCatAnimationName(runtime));
        syncWalkAnimationSpeed(runtime);
        group.position.copy(runtime.target.position);
        if (
            runtime.target.behavior === 'pillow' ||
            runtime.target.behavior === 'cover'
        ) {
            group.position.y += Math.sin(now * 1.6 + habitat.seed) * 0.006;
        }
        group.rotation.x = 0;
        group.rotation.z =
            runtime.target.behavior === 'stalk-bird'
                ? Math.sin(now * 2.2 + habitat.seed) * 0.012
                : 0;

        if (runtime.target.lookAtPosition) {
            facePosition(group, runtime.target.lookAtPosition, delta);
        } else if (runtime.target.facingYaw !== undefined) {
            faceYaw(group, runtime.target.facingYaw, delta);
        }

        const shouldMoveToPillow =
            isCatNight(timeOfDay) && runtime.target.behavior !== 'pillow';
        const shouldMoveToCover =
            shouldCatSeekCover(timeOfDay, weather) &&
            runtime.target.behavior !== 'cover' &&
            runtime.target.behavior !== 'pillow';

        if (
            !shouldMoveToPillow &&
            !shouldMoveToCover &&
            now < runtime.dwellUntil
        ) {
            return;
        }

        const target = chooseNextTarget({
            birdGroundEntries,
            habitat,
            random,
            timeOfDay,
            weather,
        });
        if (group.position.distanceTo(target.position) < 0.08) {
            runtimeRef.current = makeSettledState({
                now,
                random,
                target,
                timeOfDay,
                weather,
            });
            return;
        }

        runtimeRef.current = makeMovingState({
            blockedCells: habitat.blockedCells,
            from: group.position.clone(),
            fromTarget: runtime.target,
            groundSurfaces: habitat.groundSurfaces,
            now,
            target,
        });
    });

    useFrame(({ clock }) => {
        const runtime = runtimeRef.current;
        const group = groupRef.current;
        const now = clock.elapsedTime;

        if (
            enableDebugHudFlag &&
            runtime &&
            group &&
            now - lastAnimalDebugUpdateRef.current >= 0.5
        ) {
            lastAnimalDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createCatDebugEntry({ group, habitat, now, runtime }),
            );
        }
    });

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js element is interactive
        <group
            ref={groupRef}
            scale={catScale}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
        >
            <primitive object={catModel} />
        </group>
    );
}

function resolveCatWeather({
    gameWeather,
    weatherDisabled,
    weatherNow,
    weatherOverride,
}: {
    gameWeather: GameState['weather'];
    weatherDisabled: boolean;
    weatherNow: CatWeather | null | undefined;
    weatherOverride: CatWeatherOverride | undefined;
}) {
    if (weatherDisabled) {
        return clearCatWeather;
    }

    if (weatherOverride) {
        return { ...clearCatWeather, ...weatherOverride };
    }

    if (!weatherNow && !gameWeather) {
        return undefined;
    }

    return { ...clearCatWeather, ...weatherNow, ...gameWeather };
}

export function Cats({
    stacks,
    weather,
    weatherDisabled = false,
}: {
    stacks: Stack[] | undefined;
    weather?: CatWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const { data: blockData } = useBlockData();
    const gameWeather = useGameState((state) => state.weather);
    const animalDebugEntries = useGameState(
        (state) => state.animalDebugEntries,
    );
    const birdGroundEntries = useMemo(
        () =>
            animalDebugEntries.filter(
                (entry) =>
                    entry.species === 'Bird' && entry.behavior === 'ground',
            ),
        [animalDebugEntries],
    );
    const { data: weatherNow } = useWeatherNow(!weatherDisabled && !weather);
    const catWeather = resolveCatWeather({
        gameWeather,
        weatherDisabled,
        weatherNow,
        weatherOverride: weather,
    });
    const habitats = useMemo(
        () => createCatHabitats(stacks, blockData),
        [blockData, stacks],
    );

    if (habitats.length <= 0) {
        return null;
    }

    return (
        <>
            {habitats.map((habitat) => (
                <Cat
                    key={habitat.id}
                    birdGroundEntries={birdGroundEntries}
                    habitat={habitat}
                    weather={catWeather}
                />
            ))}
        </>
    );
}
