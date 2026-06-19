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
    type AnimalPresenceEntry,
    type GameState,
    useGameState,
} from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import {
    type AnimalDebugPathPoint,
    AnimalPathDebugIndicator,
    AnimalTargetDebugMarker,
} from '../animals/AnimalDebugIndicators';
import {
    animalPresencePosition,
    animalPresenceUpdateIntervalSeconds,
    freshAnimalPresences,
} from '../animals/animalPresence';
import {
    type DogBehavior,
    type DogWeather,
    getDogActivityRange,
    getDogDwellSeconds,
    isDogNight,
    pickDogBehavior,
    shouldDogSeekCover,
} from './dogBehavior';
import {
    type DogPathCell,
    type DogPathResult,
    type DogPathSurface,
    findDogPath,
} from './dogPathfinding';

type DogWeatherOverride = Partial<NonNullable<GameState['weather']>>;

type DogTarget = {
    id: string;
    behavior: DogBehavior;
    facingYaw?: number;
    lookAtPosition?: Vector3;
    position: Vector3;
    walkPosition?: Vector3;
};

type DogGroundSurface = DogPathSurface;

type DogHabitat = {
    id: string;
    blockedCells: DogPathCell[];
    covers: DogTarget[];
    groundSurfaces: DogGroundSurface[];
    lowEntities: DogTarget[];
    dogHouse: DogTarget;
    roamAnchors: DogTarget[];
    seed: number;
};

type MovingDogState = {
    phase: 'moving';
    duration: number;
    from: Vector3;
    groundSurfaces: DogGroundSurface[];
    path: Vector3[];
    pathDistance: number;
    pathfinding: DogPathResult;
    startedAt: number;
    target: DogTarget;
    to: Vector3;
};

type SettledDogState = {
    phase: 'settled';
    dwellUntil: number;
    target: DogTarget;
};

type DogRuntimeState = MovingDogState | SettledDogState;

type DogRigNode = {
    object: Object3D | null;
    basePositionY: number;
    basePositionZ: number;
    baseRotationX: number;
    baseRotationZ: number;
};

type DogRigParts = {
    frontLeftLeg: DogRigNode;
    frontLeftPaw: DogRigNode;
    frontRightLeg: DogRigNode;
    frontRightPaw: DogRigNode;
    rearLeftLeg: DogRigNode;
    rearLeftPaw: DogRigNode;
    rearRightLeg: DogRigNode;
    rearRightPaw: DogRigNode;
    walkPhase: number;
    walkPoseAmount: number;
};

type DogAnimationName =
    | 'Dog_Idle'
    | 'Dog_Walk'
    | 'Dog_LyingIdle'
    | 'Dog_PreyWatch';

const dogDebugBehaviors = [
    'doghouse',
    'roam',
    'cover',
    'low-entity',
    'chase-bird',
    'interact-cat',
] satisfies DogBehavior[];

const clearDogWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
} satisfies DogWeather;

const dogScale = 0.46;
const dogGroundLift = 0.02;
const dogHouseDoorOffset = 0.46;
const dogHouseNightRestInset = 0.42;
const dogGroundSurfaceHalfSize = 0.5;
const dogGroundSurfaceEpsilon = 0.001;
const dogWalkSpeedBlocksPerSecond = 0.9;
const dogWalkCycleDistance = 0.82;
const dogWalkAnimationFallbackDuration = 32 / 24;
const dogWalkAnimationMinTimeScale = 0.5;
const dogWalkAnimationMaxTimeScale = 1.65;
const dogWalkBodyBobHeight = 0.016;
const dogWalkTurnDamping = 9;
const dogIdleTurnDamping = 10;
const dogWalkLookAheadProgress = 0.06;
const dogWalkRollAmount = 0.02;
const dogWalkLegPoseDamping = 12;
const dogWalkLegSwing = 0.3;
const dogWalkFootLift = 0.045;
const dogVisualYawOffset = Math.PI;
const fullTurn = Math.PI * 2;
const dogDarkFurColor = '#3c2115';
const dogSoftDarkFurColor = '#7b4d2c';

const dogHouseBlockNames = new Set(['DogHouse']);
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

function getDogGroundYFromHeight(height: number) {
    return height > 0 ? height + dogGroundLift : 0;
}

function getDogWalkYAt(
    position: Pick<Vector3, 'x' | 'z'>,
    groundSurfaces: DogGroundSurface[],
) {
    let surfaceY: number | null = null;

    for (const surface of groundSurfaces) {
        const insideSurface =
            Math.abs(position.x - surface.x) <=
                dogGroundSurfaceHalfSize + dogGroundSurfaceEpsilon &&
            Math.abs(position.z - surface.z) <=
                dogGroundSurfaceHalfSize + dogGroundSurfaceEpsilon;

        if (insideSurface && (surfaceY === null || surface.y > surfaceY)) {
            surfaceY = surface.y;
        }
    }

    return surfaceY ?? 0;
}

function getTargetWalkPosition(target: DogTarget) {
    return (target.walkPosition ?? target.position).clone();
}

function copyDogSettledPosition(
    result: Vector3,
    target: DogTarget,
    timeOfDay: number,
) {
    result.copy(target.position);

    if (
        target.behavior === 'doghouse' &&
        isDogNight(timeOfDay) &&
        target.facingYaw !== undefined
    ) {
        result.x -= Math.sin(target.facingYaw) * dogHouseNightRestInset;
        result.z -= Math.cos(target.facingYaw) * dogHouseNightRestInset;
    }

    return result;
}

function isDogSettledAtTarget(runtime: DogRuntimeState, target: DogTarget) {
    return (
        runtime.phase === 'settled' &&
        runtime.target.id === target.id &&
        runtime.target.behavior === target.behavior
    );
}

function candidatesInRange<T extends { position: Vector3 }>(
    candidates: T[],
    home: DogTarget,
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

function isDogHouseBlockName(name: string) {
    return dogHouseBlockNames.has(name);
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

    return hasGroundBlock ? getDogGroundYFromHeight(height) : null;
}

function createDogGroundSurfaces(
    stacks: Stack[] | undefined,
    blockData: BlockData[] | null | undefined,
) {
    const surfaces: DogGroundSurface[] = [];

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

function createDogBlockedCells(stacks: Stack[] | undefined) {
    const blockedCells: DogPathCell[] = [];

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

function targetForDogHouseBlock({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const stackHeight = getStackHeight(blockData, stack, block);
    const dogHouseYaw = blockRotationToYaw(block.rotation);
    const doorPosition = new Vector3(
        Math.sin(dogHouseYaw) * dogHouseDoorOffset,
        0,
        Math.cos(dogHouseYaw) * dogHouseDoorOffset,
    );
    const walkPosition = new Vector3(
        stack.position.x + doorPosition.x,
        getDogGroundYFromHeight(stackHeight),
        stack.position.z + doorPosition.z,
    );

    return {
        behavior: 'doghouse',
        facingYaw: dogHouseYaw,
        id: `doghouse-${block.id}`,
        position: new Vector3(
            walkPosition.x,
            walkPosition.y + dogGroundLift,
            walkPosition.z,
        ),
        walkPosition,
    } satisfies DogTarget;
}

function targetForGroundStack(
    stack: Stack,
    blockData: BlockData[] | null | undefined,
) {
    const position = new Vector3(
        stack.position.x,
        getDogGroundYFromHeight(getStackHeight(blockData, stack)),
        stack.position.z,
    );

    return {
        behavior: 'roam',
        id: `roam-${stack.position.x}-${stack.position.z}`,
        position,
        walkPosition: position.clone(),
    } satisfies DogTarget;
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
    const y = getDogGroundYFromHeight(getStackHeight(blockData, stack, block));
    const position = new Vector3(x, y, z);

    return {
        behavior: 'cover',
        facingYaw: Math.atan2(stack.position.x - x, stack.position.z - z),
        id: `cover-${block.id}`,
        position,
        walkPosition: position.clone(),
    } satisfies DogTarget;
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
            stackHeight + yOffset + dogGroundLift,
            stack.position.z,
        ),
        walkPosition: new Vector3(
            stack.position.x,
            getDogGroundYFromHeight(stackHeight),
            stack.position.z,
        ),
    } satisfies DogTarget;
}

function createDogHabitats(
    stacks: Stack[] | undefined,
    blockData: BlockData[] | null | undefined,
) {
    const blockedCells = createDogBlockedCells(stacks);
    const groundSurfaces = createDogGroundSurfaces(stacks, blockData);
    const dogHouses: DogTarget[] = [];
    const covers: DogTarget[] = [];
    const lowEntities: DogTarget[] = [];
    const roamAnchors: DogTarget[] = [];

    for (const stack of stacks ?? []) {
        for (const block of stack.blocks) {
            if (isDogHouseBlockName(block.name)) {
                dogHouses.push(
                    targetForDogHouseBlock({ block, blockData, stack }),
                );
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
            !isDogHouseBlockName(topBlock.name) &&
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

    return dogHouses.map((dogHouse) => ({
        id: `dog-${dogHouse.id}`,
        blockedCells,
        covers,
        groundSurfaces,
        lowEntities,
        dogHouse,
        roamAnchors,
        seed: hashString(dogHouse.id),
    }));
}

function movementDuration(distance: number) {
    return MathUtils.clamp(distance / dogWalkSpeedBlocksPerSecond, 0.55, 7);
}

function movingDogHorizontalSpeed(runtime: MovingDogState) {
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

function vectorFromPathPoint(point: DogPathSurface) {
    return new Vector3(point.x, point.y, point.z);
}

function vectorPathFromResult(pathfinding: DogPathResult) {
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

function dogWalkAnimationTimeScale(
    runtime: DogRuntimeState | null,
    action: AnimationAction | null | undefined,
) {
    if (runtime?.phase !== 'moving') {
        return 1;
    }

    const clipDuration =
        action?.getClip().duration ?? dogWalkAnimationFallbackDuration;
    const speed = movingDogHorizontalSpeed(runtime);

    return MathUtils.clamp(
        (speed * clipDuration) / dogWalkCycleDistance,
        dogWalkAnimationMinTimeScale,
        dogWalkAnimationMaxTimeScale,
    );
}

function faceYaw(
    group: Group,
    targetYaw: number,
    delta: number,
    turnDamping = dogIdleTurnDamping,
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
    turnDamping = dogIdleTurnDamping,
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
    habitat: DogHabitat;
    random: () => number;
    range: number;
}) {
    const anchors = candidatesInRange(
        habitat.roamAnchors,
        habitat.dogHouse,
        range,
    );
    const anchor = pickCandidate(anchors, random) ?? habitat.dogHouse;
    const anchorWalkPosition = getTargetWalkPosition(anchor);
    const radius = anchor === habitat.dogHouse ? 0.42 : 0.24 + random() * 0.28;
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
    } satisfies DogTarget;
}

function getGroundBirdTargets({
    birdGroundEntries,
    habitat,
    range,
}: {
    birdGroundEntries: AnimalDebugEntry[];
    habitat: DogHabitat;
    range: number;
}) {
    return birdGroundEntries.filter((entry) => {
        const position = new Vector3(
            entry.position.x,
            entry.position.y,
            entry.position.z,
        );
        return horizontalDistance(position, habitat.dogHouse.position) <= range;
    });
}

function createChaseBirdTarget({
    birdGroundTargets,
    habitat,
    random,
}: {
    birdGroundTargets: AnimalDebugEntry[];
    habitat: DogHabitat;
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
    const approach = habitat.dogHouse.position.clone().sub(birdPosition);
    if (approach.lengthSq() <= 0.001) {
        const angle = random() * fullTurn;
        approach.set(Math.cos(angle), 0, Math.sin(angle));
    }
    approach.y = 0;
    approach.setLength(0.34 + random() * 0.16);

    const position = birdPosition.clone().add(approach);
    position.y = getDogWalkYAt(position, habitat.groundSurfaces);

    return {
        behavior: 'chase-bird',
        facingYaw: Math.atan2(
            birdPosition.x - position.x,
            birdPosition.z - position.z,
        ),
        id: `chase-bird-${targetBird.id}`,
        lookAtPosition: birdPosition,
        position,
        walkPosition: position.clone(),
    } satisfies DogTarget;
}

function getCatInteractionTargets({
    catPresenceEntries,
    habitat,
    now,
    range,
}: {
    catPresenceEntries: AnimalPresenceEntry[];
    habitat: DogHabitat;
    now: number;
    range: number;
}) {
    return freshAnimalPresences({
        entries: catPresenceEntries,
        now,
        species: 'Cat',
    }).filter(
        (entry) =>
            horizontalDistance(
                animalPresencePosition(entry),
                habitat.dogHouse.position,
            ) <= range,
    );
}

function createInteractCatTarget({
    catInteractionTargets,
    habitat,
    random,
}: {
    catInteractionTargets: AnimalPresenceEntry[];
    habitat: DogHabitat;
    random: () => number;
}) {
    const targetCat = pickCandidate(catInteractionTargets, random);
    if (!targetCat) {
        return null;
    }

    const catPosition = animalPresencePosition(targetCat);
    const approach = habitat.dogHouse.position.clone().sub(catPosition);
    if (approach.lengthSq() <= 0.001) {
        const angle = random() * fullTurn;
        approach.set(Math.cos(angle), 0, Math.sin(angle));
    }
    approach.y = 0;
    approach.setLength(0.42 + random() * 0.16);

    const position = catPosition.clone().add(approach);
    position.y = getDogWalkYAt(position, habitat.groundSurfaces);

    return {
        behavior: 'interact-cat',
        facingYaw: Math.atan2(
            catPosition.x - position.x,
            catPosition.z - position.z,
        ),
        id: `interact-cat-${targetCat.id}`,
        lookAtPosition: catPosition,
        position,
        walkPosition: position.clone(),
    } satisfies DogTarget;
}

function chooseNextTarget({
    birdGroundEntries,
    catPresenceEntries,
    habitat,
    now,
    random,
    timeOfDay,
    weather,
}: {
    birdGroundEntries: AnimalDebugEntry[];
    catPresenceEntries: AnimalPresenceEntry[];
    habitat: DogHabitat;
    now: number;
    random: () => number;
    timeOfDay: number;
    weather: DogWeather | null | undefined;
}) {
    const range = getDogActivityRange(timeOfDay, weather);
    const covers = candidatesInRange(habitat.covers, habitat.dogHouse, range);
    const lowEntities = candidatesInRange(
        habitat.lowEntities,
        habitat.dogHouse,
        range,
    );
    const roamAnchors = candidatesInRange(
        habitat.roamAnchors,
        habitat.dogHouse,
        range,
    );
    const birdGroundTargets = getGroundBirdTargets({
        birdGroundEntries,
        habitat,
        range,
    });
    const catInteractionTargets = getCatInteractionTargets({
        catPresenceEntries,
        habitat,
        now,
        range,
    });
    const behavior = pickDogBehavior({
        availability: {
            cover: covers.length > 0,
            'low-entity': lowEntities.length > 0,
            roam: roamAnchors.length > 0,
            'chase-bird': birdGroundTargets.length > 0,
            'interact-cat': catInteractionTargets.length > 0,
        },
        random,
        timeOfDay,
        weather,
    });

    if (behavior === 'cover') {
        return pickCandidate(covers, random) ?? habitat.dogHouse;
    }

    if (behavior === 'chase-bird') {
        return (
            createChaseBirdTarget({ birdGroundTargets, habitat, random }) ??
            habitat.dogHouse
        );
    }

    if (behavior === 'interact-cat') {
        return (
            createInteractCatTarget({
                catInteractionTargets,
                habitat,
                random,
            }) ?? habitat.dogHouse
        );
    }

    if (behavior === 'low-entity') {
        return pickCandidate(lowEntities, random) ?? habitat.dogHouse;
    }

    if (behavior === 'roam') {
        return createRoamTarget({ habitat, random, range });
    }

    return habitat.dogHouse;
}

function chooseManualNextTarget({
    birdGroundEntries,
    catPresenceEntries,
    currentTarget,
    habitat,
    now,
    random,
    timeOfDay,
    weather,
}: {
    birdGroundEntries: AnimalDebugEntry[];
    catPresenceEntries: AnimalPresenceEntry[];
    currentTarget: DogTarget;
    habitat: DogHabitat;
    now: number;
    random: () => number;
    timeOfDay: number;
    weather: DogWeather | null | undefined;
}) {
    const target = chooseNextTarget({
        birdGroundEntries,
        catPresenceEntries,
        habitat,
        now,
        random,
        timeOfDay,
        weather,
    });
    const canManuallyReturnToDogHouse =
        isDogNight(timeOfDay) || shouldDogSeekCover(timeOfDay, weather);

    if (
        (target.id !== currentTarget.id ||
            target.behavior !== currentTarget.behavior) &&
        (target.behavior !== 'doghouse' || canManuallyReturnToDogHouse)
    ) {
        return target;
    }

    const range = getDogActivityRange(timeOfDay, weather);
    const covers = candidatesInRange(habitat.covers, habitat.dogHouse, range);
    const lowEntities = candidatesInRange(
        habitat.lowEntities,
        habitat.dogHouse,
        range,
    );
    const roamAnchors = candidatesInRange(
        habitat.roamAnchors,
        habitat.dogHouse,
        range,
    );
    const birdGroundTargets = getGroundBirdTargets({
        birdGroundEntries,
        habitat,
        range,
    });
    const catInteractionTargets = getCatInteractionTargets({
        catPresenceEntries,
        habitat,
        now,
        range,
    });
    const alternatives: DogTarget[] = [];

    if (currentTarget.behavior !== 'roam' && roamAnchors.length > 0) {
        alternatives.push(createRoamTarget({ habitat, random, range }));
    }

    if (currentTarget.behavior !== 'cover') {
        alternatives.push(...covers);
    }

    if (currentTarget.behavior !== 'chase-bird') {
        const chaseTarget = createChaseBirdTarget({
            birdGroundTargets,
            habitat,
            random,
        });
        if (chaseTarget) {
            alternatives.push(chaseTarget);
        }
    }

    if (currentTarget.behavior !== 'interact-cat') {
        const interactTarget = createInteractCatTarget({
            catInteractionTargets,
            habitat,
            random,
        });
        if (interactTarget) {
            alternatives.push(interactTarget);
        }
    }

    if (currentTarget.behavior !== 'low-entity') {
        alternatives.push(...lowEntities);
    }

    if (currentTarget.behavior !== 'doghouse' && canManuallyReturnToDogHouse) {
        alternatives.push(habitat.dogHouse);
    }

    return pickCandidate(alternatives, random) ?? target;
}

function chooseDebugTarget({
    behavior,
    birdGroundEntries,
    catPresenceEntries,
    habitat,
    now,
    random,
    timeOfDay,
    weather,
}: {
    behavior: string;
    birdGroundEntries: AnimalDebugEntry[];
    catPresenceEntries: AnimalPresenceEntry[];
    habitat: DogHabitat;
    now: number;
    random: () => number;
    timeOfDay: number;
    weather: DogWeather | null | undefined;
}) {
    const range = getDogActivityRange(timeOfDay, weather);

    if (behavior === 'doghouse') {
        return habitat.dogHouse;
    }

    if (behavior === 'roam') {
        return createRoamTarget({ habitat, random, range });
    }

    if (behavior === 'cover') {
        return (
            pickCandidate(
                candidatesInRange(habitat.covers, habitat.dogHouse, range),
                random,
            ) ?? habitat.dogHouse
        );
    }

    if (behavior === 'low-entity') {
        return (
            pickCandidate(
                candidatesInRange(habitat.lowEntities, habitat.dogHouse, range),
                random,
            ) ?? habitat.dogHouse
        );
    }

    if (behavior === 'chase-bird') {
        return (
            createChaseBirdTarget({
                birdGroundTargets: getGroundBirdTargets({
                    birdGroundEntries,
                    habitat,
                    range,
                }),
                habitat,
                random,
            }) ?? habitat.dogHouse
        );
    }

    if (behavior === 'interact-cat') {
        return (
            createInteractCatTarget({
                catInteractionTargets: getCatInteractionTargets({
                    catPresenceEntries,
                    habitat,
                    now,
                    range,
                }),
                habitat,
                random,
            }) ?? habitat.dogHouse
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
    blockedCells?: DogPathCell[];
    from: Vector3;
    fromTarget?: DogTarget;
    groundSurfaces?: DogGroundSurface[];
    now: number;
    target: DogTarget;
}) {
    const walkFrom = fromTarget
        ? getTargetWalkPosition(fromTarget)
        : from.clone();
    const walkTo = getTargetWalkPosition(target);
    const resolvedGroundSurfaces = groundSurfaces ?? [];
    if (groundSurfaces) {
        walkFrom.y = getDogWalkYAt(walkFrom, groundSurfaces);
        walkTo.y = getDogWalkYAt(walkTo, groundSurfaces);
    }

    const pathfinding = findDogPath({
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
    } satisfies MovingDogState;
}

function movingPositionAt(runtime: MovingDogState, progress: number) {
    const walkDistance = runtime.pathDistance * progress;
    const position = pathPositionAtDistance(runtime.path, walkDistance);
    const walkPhase = (walkDistance / dogWalkCycleDistance) * fullTurn;

    position.y = getDogWalkYAt(position, runtime.groundSurfaces);
    position.y += Math.max(0, Math.sin(walkPhase * 2)) * dogWalkBodyBobHeight;
    position.y += Math.max(0, Math.sin(walkPhase)) * dogWalkBodyBobHeight * 0.2;

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
    target: DogTarget;
    timeOfDay: number;
    weather: DogWeather | null | undefined;
}) {
    return {
        phase: 'settled',
        dwellUntil:
            now +
            getDogDwellSeconds({
                behavior: target.behavior,
                random,
                timeOfDay,
                weather,
            }),
        target,
    } satisfies SettledDogState;
}

function getDogAnimationName(runtime: DogRuntimeState): DogAnimationName {
    if (runtime.phase === 'moving') {
        return 'Dog_Walk';
    }

    if (
        runtime.target.behavior === 'doghouse' ||
        runtime.target.behavior === 'cover'
    ) {
        return 'Dog_LyingIdle';
    }

    if (runtime.target.behavior === 'chase-bird') {
        return 'Dog_PreyWatch';
    }

    return 'Dog_Idle';
}

function isMesh(object: Object3D): object is Mesh {
    return object instanceof Mesh;
}

function getDogDebugActivity(runtime: DogRuntimeState) {
    if (runtime.phase === 'moving') {
        return `walking to ${runtime.target.behavior}`;
    }

    if (runtime.target.behavior === 'doghouse') {
        return 'resting by doghouse';
    }

    if (runtime.target.behavior === 'cover') {
        return 'resting under cover';
    }

    if (runtime.target.behavior === 'chase-bird') {
        return 'chasing ground birds';
    }

    if (runtime.target.behavior === 'interact-cat') {
        return 'greeting cat';
    }

    if (runtime.target.behavior === 'low-entity') {
        return 'sniffing around block';
    }

    return 'roaming';
}

function roundDogDebugCoordinate(value: number) {
    return Math.round(value * 100) / 100;
}

function roundDogDebugPoint(point: Vector3) {
    return {
        x: roundDogDebugCoordinate(point.x),
        y: roundDogDebugCoordinate(point.y),
        z: roundDogDebugCoordinate(point.z),
    };
}

function dogDebugPathPoint(point: Vector3) {
    return [
        roundDogDebugCoordinate(point.x),
        roundDogDebugCoordinate(point.y),
        roundDogDebugCoordinate(point.z),
    ] satisfies AnimalDebugPathPoint;
}

function dogDebugPathKey(path: Vector3[]) {
    return path.map((point) => dogDebugPathPoint(point).join(':')).join('|');
}

function nextPathWaypoint(runtime: MovingDogState, position: Vector3) {
    return (
        runtime.path.find(
            (point) => horizontalDistance(point, position) > 0.12,
        ) ?? runtime.to
    );
}

function createDogDebugEntry({
    group,
    habitat,
    now,
    runtime,
}: {
    group: Group;
    habitat: DogHabitat;
    now: number;
    runtime: DogRuntimeState;
}): AnimalDebugEntry {
    return {
        id: habitat.id,
        species: 'Dog',
        label: habitat.dogHouse.id.replace(/^doghouse-/, ''),
        phase: runtime.phase,
        behavior: runtime.target.behavior,
        activity: getDogDebugActivity(runtime),
        targetId: runtime.target.id,
        debugBehaviors: dogDebugBehaviors,
        pathfinding:
            runtime.phase === 'moving'
                ? {
                      blockedCellCount: runtime.pathfinding.blockedCellCount,
                      distance: roundDogDebugCoordinate(runtime.pathDistance),
                      nextWaypoint: roundDogDebugPoint(
                          nextPathWaypoint(runtime, group.position),
                      ),
                      status: runtime.pathfinding.status,
                      targetCell: runtime.pathfinding.targetCell,
                      visitedCellCount: runtime.pathfinding.visitedCellCount,
                      waypointCount: runtime.path.length,
                  }
                : undefined,
        position: roundDogDebugPoint(group.position),
        updatedAt: now,
    };
}

function getDogMaterialTint(materialName: string) {
    if (materialName.includes('Material.Dog.BlackFurSoft')) {
        return dogSoftDarkFurColor;
    }

    if (materialName.includes('Material.Dog.BlackFur')) {
        return dogDarkFurColor;
    }

    return null;
}

function cloneDogMaterial(material: Material) {
    const clone = material.clone();
    const tint = getDogMaterialTint(material.name);

    if (tint && clone instanceof MeshStandardMaterial) {
        clone.color.set(tint);
        clone.metalness = 0;
        clone.roughness = Math.max(clone.roughness, 0.82);
    }

    return clone;
}

function prepareDogMesh(object: Mesh) {
    object.castShadow = true;
    object.frustumCulled = false;
    object.receiveShadow = true;
    object.material = Array.isArray(object.material)
        ? object.material.map(cloneDogMaterial)
        : cloneDogMaterial(object.material);
}

function getDogRigNode(root: Object3D, name: string): DogRigNode {
    const object = root.getObjectByName(name) ?? null;

    return {
        object,
        basePositionY: object?.position.y ?? 0,
        basePositionZ: object?.position.z ?? 0,
        baseRotationX: object?.rotation.x ?? 0,
        baseRotationZ: object?.rotation.z ?? 0,
    };
}

function createDogRig(root: Object3D): DogRigParts {
    return {
        frontLeftLeg: getDogRigNode(root, 'Dog_Leg_FL'),
        frontLeftPaw: getDogRigNode(root, 'Dog_Paw_FL'),
        frontRightLeg: getDogRigNode(root, 'Dog_Leg_FR'),
        frontRightPaw: getDogRigNode(root, 'Dog_Paw_FR'),
        rearLeftLeg: getDogRigNode(root, 'Dog_Leg_RL'),
        rearLeftPaw: getDogRigNode(root, 'Dog_Paw_RL'),
        rearRightLeg: getDogRigNode(root, 'Dog_Leg_RR'),
        rearRightPaw: getDogRigNode(root, 'Dog_Paw_RR'),
        walkPhase: 0,
        walkPoseAmount: 0,
    };
}

function poseDogLeg({
    leg,
    paw,
    lift,
    swing,
}: {
    leg: DogRigNode;
    lift: number;
    paw: DogRigNode;
    swing: number;
}) {
    if (leg.object) {
        leg.object.rotation.x = leg.baseRotationX + swing;
        leg.object.rotation.z = leg.baseRotationZ + swing * 0.08;
    }

    if (paw.object) {
        paw.object.position.y = paw.basePositionY + lift * dogWalkFootLift;
        paw.object.position.z = paw.basePositionZ - swing * 0.055;
        paw.object.rotation.x = paw.baseRotationX - swing * 0.42 + lift * 0.16;
    }
}

function updateDogWalkPose({
    delta,
    moving,
    rig,
    walkDistance,
}: {
    delta: number;
    moving: boolean;
    rig: DogRigParts;
    walkDistance: number;
}) {
    rig.walkPoseAmount = MathUtils.damp(
        rig.walkPoseAmount,
        moving ? 1 : 0,
        dogWalkLegPoseDamping,
        delta,
    );

    if (moving) {
        rig.walkPhase = (walkDistance / dogWalkCycleDistance) * fullTurn;
    }

    const amount = rig.walkPoseAmount;
    const phase = rig.walkPhase;
    const diagonalStep = Math.sin(phase);
    const diagonalSwing = diagonalStep * dogWalkLegSwing * amount;
    const oppositeSwing = -diagonalSwing;
    const diagonalLift = Math.max(0, diagonalStep) * amount;
    const oppositeLift = Math.max(0, -diagonalStep) * amount;

    poseDogLeg({
        leg: rig.frontLeftLeg,
        lift: diagonalLift,
        paw: rig.frontLeftPaw,
        swing: diagonalSwing,
    });
    poseDogLeg({
        leg: rig.rearRightLeg,
        lift: diagonalLift,
        paw: rig.rearRightPaw,
        swing: diagonalSwing,
    });
    poseDogLeg({
        leg: rig.frontRightLeg,
        lift: oppositeLift,
        paw: rig.frontRightPaw,
        swing: oppositeSwing,
    });
    poseDogLeg({
        leg: rig.rearLeftLeg,
        lift: oppositeLift,
        paw: rig.rearLeftPaw,
        swing: oppositeSwing,
    });
}

function Dog({
    birdGroundEntries,
    catPresenceEntries,
    habitat,
    weather,
}: {
    birdGroundEntries: AnimalDebugEntry[];
    catPresenceEntries: AnimalPresenceEntry[];
    habitat: DogHabitat;
    weather: DogWeather | null | undefined;
}) {
    const gltf = useGameGLTF('Dog');
    const { enableDebugHudFlag = false } = useGameFlags();
    const clock = useThree((state) => state.clock);
    const groupRef = useRef<Group>(null);
    const targetDebugRef = useRef<Group>(null);
    const randomRef = useRef(createRandom(habitat.seed));
    const runtimeRef = useRef<DogRuntimeState | null>(null);
    const lastAnimalDebugUpdateRef = useRef(0);
    const lastAnimalPresenceUpdateRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const pathDebugKeyRef = useRef('');
    const activeAnimationRef = useRef<DogAnimationName>('Dog_LyingIdle');
    const [activeAnimation, setActiveAnimation] =
        useState<DogAnimationName>('Dog_LyingIdle');
    const [pathDebugPoints, setPathDebugPoints] = useState<
        AnimalDebugPathPoint[]
    >([]);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const animalPathfindingDebugVisible = useGameState(
        (state) => state.animalPathfindingDebugVisible,
    );
    const animalTargetsDebugVisible = useGameState(
        (state) => state.animalTargetsDebugVisible,
    );
    const animalDebugCommand = useGameState(
        (state) => state.animalDebugCommand,
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

    const dogModel = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse((object) => {
            if (isMesh(object)) {
                prepareDogMesh(object);
            }
        });
        return {
            rig: createDogRig(clone),
            scene: clone,
        };
    }, [gltf.scene]);
    const { actions } = useAnimations(gltf.animations, dogModel.scene);

    useEffect(() => {
        const action = actions[activeAnimation];
        if (!action) {
            return;
        }

        action.timeScale =
            activeAnimation === 'Dog_Walk'
                ? dogWalkAnimationTimeScale(runtimeRef.current, action)
                : 1;
        action.reset().fadeIn(0.18).play();
        return () => {
            action.fadeOut(0.18);
        };
    }, [actions, activeAnimation]);

    useEffect(() => {
        runtimeRef.current = null;
        if (groupRef.current) {
            groupRef.current.position.copy(habitat.dogHouse.position);
            if (habitat.dogHouse.facingYaw !== undefined) {
                groupRef.current.rotation.y = habitat.dogHouse.facingYaw;
            }
        }
    }, [habitat.dogHouse.facingYaw, habitat.dogHouse.position]);

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

    const syncDebugIndicators = (runtime: DogRuntimeState | null) => {
        const targetDebug = targetDebugRef.current;
        if (targetDebug) {
            targetDebug.visible = animalTargetsDebugVisible && runtime !== null;
            if (targetDebug.visible && runtime) {
                targetDebug.position.copy(runtime.target.position);
            }
        }

        const nextPathDebugKey =
            animalPathfindingDebugVisible && runtime?.phase === 'moving'
                ? dogDebugPathKey(runtime.path)
                : '';

        if (nextPathDebugKey !== pathDebugKeyRef.current) {
            pathDebugKeyRef.current = nextPathDebugKey;
            setPathDebugPoints(
                animalPathfindingDebugVisible && runtime?.phase === 'moving'
                    ? runtime.path.map(dogDebugPathPoint)
                    : [],
            );
        }
    };

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
            catPresenceEntries,
            currentTarget: runtime.target,
            habitat,
            now,
            random,
            timeOfDay,
            weather,
        });

        if (
            isDogSettledAtTarget(runtime, target) ||
            group.position.distanceTo(target.position) < 0.08
        ) {
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

        const setAnimation = (nextAnimation: DogAnimationName) => {
            if (activeAnimationRef.current === nextAnimation) {
                return;
            }
            activeAnimationRef.current = nextAnimation;
            setActiveAnimation(nextAnimation);
        };
        const syncWalkAnimationSpeed = (nextRuntime: DogRuntimeState) => {
            const walkAction = actions.Dog_Walk;
            if (walkAction) {
                walkAction.timeScale = dogWalkAnimationTimeScale(
                    nextRuntime,
                    walkAction,
                );
            }
        };

        if (!runtime) {
            runtime = makeSettledState({
                now,
                random,
                target: habitat.dogHouse,
                timeOfDay,
                weather,
            });
            runtimeRef.current = runtime;
            group.position.copy(habitat.dogHouse.position);
            if (habitat.dogHouse.facingYaw !== undefined) {
                group.rotation.y = habitat.dogHouse.facingYaw;
            }
        }

        if (
            animalDebugCommand &&
            animalDebugCommand.sequence !==
                lastDebugCommandSequenceRef.current &&
            animalDebugCommand.species === 'Dog'
        ) {
            lastDebugCommandSequenceRef.current = animalDebugCommand.sequence;

            if (
                !animalDebugCommand.targetId ||
                animalDebugCommand.targetId === habitat.id
            ) {
                const target = chooseDebugTarget({
                    behavior: animalDebugCommand.behavior,
                    birdGroundEntries,
                    catPresenceEntries,
                    habitat,
                    now,
                    random,
                    timeOfDay,
                    weather,
                });

                if (target) {
                    runtime =
                        isDogSettledAtTarget(runtime, target) ||
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

        syncDebugIndicators(runtime);

        if (runtime.phase === 'moving') {
            setAnimation(getDogAnimationName(runtime));
            syncWalkAnimationSpeed(runtime);
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            const walkDistance = runtime.pathDistance * progress;
            const nextPosition = movingPositionAt(runtime, progress);

            group.position.copy(nextPosition);
            updateDogWalkPose({
                delta,
                moving: true,
                rig: dogModel.rig,
                walkDistance,
            });
            facePosition(
                group,
                movingPositionAt(
                    runtime,
                    MathUtils.clamp(progress + dogWalkLookAheadProgress, 0, 1),
                ),
                delta,
                dogWalkTurnDamping,
            );
            group.rotation.x = 0;
            group.rotation.z =
                Math.sin(now * 10.5 + habitat.seed) * dogWalkRollAmount;

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

        setAnimation(getDogAnimationName(runtime));
        syncWalkAnimationSpeed(runtime);
        updateDogWalkPose({
            delta,
            moving: false,
            rig: dogModel.rig,
            walkDistance: 0,
        });
        copyDogSettledPosition(group.position, runtime.target, timeOfDay);
        if (
            runtime.target.behavior === 'doghouse' ||
            runtime.target.behavior === 'cover'
        ) {
            group.position.y += Math.sin(now * 2.2 + habitat.seed) * 0.009;
        }
        group.rotation.x = 0;
        group.rotation.z =
            runtime.target.behavior === 'chase-bird'
                ? Math.sin(now * 4.2 + habitat.seed) * 0.032
                : 0;

        if (runtime.target.lookAtPosition) {
            facePosition(group, runtime.target.lookAtPosition, delta);
        } else if (runtime.target.facingYaw !== undefined) {
            faceYaw(group, runtime.target.facingYaw, delta);
        }

        const shouldMoveToCover =
            shouldDogSeekCover(timeOfDay, weather) &&
            runtime.target.behavior !== 'cover' &&
            runtime.target.behavior !== 'doghouse';

        if (!shouldMoveToCover && now < runtime.dwellUntil) {
            return;
        }

        const target = chooseNextTarget({
            birdGroundEntries,
            catPresenceEntries,
            habitat,
            now,
            random,
            timeOfDay,
            weather,
        });
        if (
            isDogSettledAtTarget(runtime, target) ||
            group.position.distanceTo(target.position) < 0.08
        ) {
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
            runtime &&
            group &&
            now - lastAnimalPresenceUpdateRef.current >=
                animalPresenceUpdateIntervalSeconds
        ) {
            lastAnimalPresenceUpdateRef.current = now;
            setAnimalPresenceEntry({
                id: habitat.id,
                species: 'Dog',
                behavior: runtime.target.behavior,
                position: roundDogDebugPoint(group.position),
                updatedAt: now,
            });
        }

        if (
            enableDebugHudFlag &&
            runtime &&
            group &&
            now - lastAnimalDebugUpdateRef.current >= 0.5
        ) {
            lastAnimalDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createDogDebugEntry({ group, habitat, now, runtime }),
            );
        }
    });

    return (
        <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js element is interactive */}
            <group
                ref={groupRef}
                scale={dogScale}
                onPointerDown={handlePointerDown}
                onClick={handleClick}
            >
                <group rotation={[0, dogVisualYawOffset, 0]}>
                    <primitive object={dogModel.scene} />
                </group>
            </group>
            <AnimalTargetDebugMarker ref={targetDebugRef} color="#f59e0b" />
            <AnimalPathDebugIndicator
                color="#f59e0b"
                points={pathDebugPoints}
                visible={animalPathfindingDebugVisible}
            />
        </>
    );
}

function resolveDogWeather({
    gameWeather,
    weatherDisabled,
    weatherNow,
    weatherOverride,
}: {
    gameWeather: GameState['weather'];
    weatherDisabled: boolean;
    weatherNow: DogWeather | null | undefined;
    weatherOverride: DogWeatherOverride | undefined;
}) {
    if (weatherDisabled) {
        return clearDogWeather;
    }

    if (weatherOverride) {
        return { ...clearDogWeather, ...weatherOverride };
    }

    if (!weatherNow && !gameWeather) {
        return undefined;
    }

    return { ...clearDogWeather, ...weatherNow, ...gameWeather };
}

export function Dogs({
    stacks,
    weather,
    weatherDisabled = false,
}: {
    stacks: Stack[] | undefined;
    weather?: DogWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const { data: blockData } = useBlockData();
    const gameWeather = useGameState((state) => state.weather);
    const animalDebugEntries = useGameState(
        (state) => state.animalDebugEntries,
    );
    const animalPresenceEntries = useGameState(
        (state) => state.animalPresenceEntries,
    );
    const birdGroundEntries = useMemo(
        () =>
            animalDebugEntries.filter(
                (entry) =>
                    entry.species === 'Bird' && entry.behavior === 'ground',
            ),
        [animalDebugEntries],
    );
    const catPresenceEntries = useMemo(
        () => animalPresenceEntries.filter((entry) => entry.species === 'Cat'),
        [animalPresenceEntries],
    );
    const { data: weatherNow } = useWeatherNow(!weatherDisabled && !weather);
    const dogWeather = resolveDogWeather({
        gameWeather,
        weatherDisabled,
        weatherNow,
        weatherOverride: weather,
    });
    const habitats = useMemo(
        () => createDogHabitats(stacks, blockData),
        [blockData, stacks],
    );

    if (habitats.length <= 0) {
        return null;
    }

    return (
        <>
            {habitats.map((habitat) => (
                <Dog
                    key={habitat.id}
                    birdGroundEntries={birdGroundEntries}
                    catPresenceEntries={catPresenceEntries}
                    habitat={habitat}
                    weather={dogWeather}
                />
            ))}
        </>
    );
}
