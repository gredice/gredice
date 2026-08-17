import type { BlockData } from '@gredice/client';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    type Group,
    MathUtils,
    type Mesh,
    type Object3D,
    Vector3,
} from 'three';
import { useGameFlags } from '../../GameFlagsContext';
import { useBlockData } from '../../hooks/useBlockData';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
    type GameState,
    useGameState,
    useGameStateStore,
} from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
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
import { AnimalPetHearts } from '../animals/AnimalPetHearts';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import {
    chickenSpeechMessages,
    pigletSpeechMessages,
} from '../animals/actorSpeechMessages';
import {
    animalAvatarFollowRepathSeconds,
    animalAvatarFollowSeconds,
    getAnimalAvatarFollowPosition,
    isFreshGardenAvatarPresence,
} from '../animals/animalAvatarFollowing';
import {
    type AnimalMovementSurface,
    canAnimalSettleAt,
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementYAt,
    isAnimalGroundBlockName,
    isAnimalSwimmingAt,
} from '../animals/animalMovementTerrain';
import { animalPresenceUpdateIntervalSeconds } from '../animals/animalPresence';
import {
    type CatPathCell,
    type CatPathResult,
    findCatPath,
} from '../cats/catPathfinding';
import {
    type FarmAnimalBehavior,
    type FarmAnimalBehaviorAvailability,
    type FarmAnimalSpecies,
    type FarmAnimalWeather,
    getFarmAnimalActivityRange,
    getFarmAnimalDwellSeconds,
    isFarmAnimalAdverseWeather,
    isFarmAnimalNight,
    pickFarmAnimalBehavior,
} from './farmAnimalBehavior';

type FarmAnimalWeatherOverride = Partial<NonNullable<GameState['weather']>>;

export type FarmAnimalTarget = {
    behavior: FarmAnimalBehavior;
    facingYaw?: number;
    id: string;
    lookAtPosition?: Vector3;
    position: Vector3;
};

export type FarmAnimalHabitat = {
    blockedCells: CatPathCell[];
    covers: FarmAnimalTarget[];
    dustBaths: FarmAnimalTarget[];
    groundSurfaces: AnimalMovementSurface[];
    home: FarmAnimalTarget;
    id: string;
    roamAnchors: FarmAnimalTarget[];
    seed: number;
    species: FarmAnimalSpecies;
    wallow: FarmAnimalTarget | null;
};

type MovingFarmAnimalState = {
    duration: number;
    groundSurfaces: AnimalMovementSurface[];
    path: Vector3[];
    pathDistance: number;
    pathfinding: CatPathResult;
    phase: 'moving';
    startedAt: number;
    target: FarmAnimalTarget;
    to: Vector3;
};

type SettledFarmAnimalState = {
    dwellUntil: number;
    phase: 'settled';
    target: FarmAnimalTarget;
};

export type FarmAnimalRuntimeState =
    | MovingFarmAnimalState
    | SettledFarmAnimalState;

type FarmAnimalConfig = {
    assetName: 'Chicken' | 'Piglet';
    debugColor: string;
    groundLift: number;
    homeBlockName: 'ChickenCoop' | 'PigletPen';
    homeDoorOffset: number;
    petHeartsOffsetY: number;
    scale: number;
    shadowSpecies: 'chicken' | 'piglet';
    speechBubbleOffsetY: number;
    speechMessages: readonly string[];
    species: FarmAnimalSpecies;
    swimDepth: number;
    walkCycleDistance: number;
    walkSpeed: number;
};

type RigNode = {
    basePositionY: number;
    baseRotationX: number;
    baseRotationY: number;
    baseRotationZ: number;
    object: Object3D | null;
};

type FarmAnimalRig = {
    body: RigNode;
    ears: RigNode[];
    head: RigNode;
    legs: RigNode[];
    tail: RigNode;
    walkPhase: number;
    walkPoseAmount: number;
    wings: RigNode[];
};

const fullTurn = Math.PI * 2;
const treeBlockNames = new Set(['Tree', 'Pine', 'PineAdvent']);
const clearFarmAnimalWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
} satisfies FarmAnimalWeather;

const chickenConfig = {
    assetName: 'Chicken',
    debugColor: '#f59e0b',
    groundLift: 0.018,
    homeBlockName: 'ChickenCoop',
    homeDoorOffset: 0.47,
    petHeartsOffsetY: 0.43,
    scale: 0.34,
    shadowSpecies: 'chicken',
    speechBubbleOffsetY: 0.49,
    speechMessages: chickenSpeechMessages,
    species: 'Chicken',
    swimDepth: 0.08,
    walkCycleDistance: 0.48,
    walkSpeed: 0.7,
} satisfies FarmAnimalConfig;

const pigletConfig = {
    assetName: 'Piglet',
    debugColor: '#fb7185',
    groundLift: 0.022,
    homeBlockName: 'PigletPen',
    homeDoorOffset: 0.42,
    petHeartsOffsetY: 0.5,
    scale: 0.44,
    shadowSpecies: 'piglet',
    speechBubbleOffsetY: 0.57,
    speechMessages: pigletSpeechMessages,
    species: 'Piglet',
    swimDepth: 0.12,
    walkCycleDistance: 0.62,
    walkSpeed: 0.82,
} satisfies FarmAnimalConfig;

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

function horizontalDistance(
    left: Pick<Vector3, 'x' | 'z'>,
    right: Pick<Vector3, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function blockRotationToYaw(rotation: number) {
    return rotation * (Math.PI / 2) + Math.PI;
}

function isDustBathGround(name: string) {
    return name.includes('Dry_Ground') || name.includes('Sand');
}

function targetForHomeBlock({
    block,
    blockData,
    config,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    config: FarmAnimalConfig;
    stack: Stack;
}) {
    const groundY = Math.max(
        0,
        getStackHeight(blockData, stack, block) + config.groundLift,
    );
    const facingYaw = blockRotationToYaw(block.rotation);
    const position = new Vector3(
        stack.position.x + Math.sin(facingYaw) * config.homeDoorOffset,
        groundY,
        stack.position.z + Math.cos(facingYaw) * config.homeDoorOffset,
    );

    return {
        behavior: 'home',
        facingYaw,
        id: `home-${block.id}`,
        position,
    } satisfies FarmAnimalTarget;
}

function targetForWallow({
    block,
    blockData,
    config,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    config: FarmAnimalConfig;
    stack: Stack;
}) {
    const facingYaw = blockRotationToYaw(block.rotation);
    const groundY = Math.max(
        0,
        getStackHeight(blockData, stack, block) + config.groundLift,
    );
    return {
        behavior: 'wallow',
        facingYaw,
        id: `wallow-${block.id}`,
        position: new Vector3(
            stack.position.x + Math.sin(facingYaw) * 0.12,
            groundY,
            stack.position.z + Math.cos(facingYaw) * 0.12,
        ),
    } satisfies FarmAnimalTarget;
}

function targetForGroundStack({
    blockData,
    behavior,
    config,
    stack,
}: {
    blockData: BlockData[] | null | undefined;
    behavior: FarmAnimalBehavior;
    config: FarmAnimalConfig;
    stack: Stack;
}) {
    return {
        behavior,
        id: `${behavior}-${stack.position.x}-${stack.position.z}`,
        position: new Vector3(
            stack.position.x,
            Math.max(0, getStackHeight(blockData, stack) + config.groundLift),
            stack.position.z,
        ),
    } satisfies FarmAnimalTarget;
}

function targetForCover({
    block,
    blockData,
    config,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    config: FarmAnimalConfig;
    stack: Stack;
}) {
    const seed = hashString(block.id);
    const angle = (seed / 4294967296) * fullTurn;
    const radius = 0.28 + ((seed >>> 5) % 7) * 0.015;
    const position = new Vector3(
        stack.position.x + Math.cos(angle) * radius,
        Math.max(
            0,
            getStackHeight(blockData, stack, block) + config.groundLift,
        ),
        stack.position.z + Math.sin(angle) * radius,
    );
    return {
        behavior: 'cover',
        facingYaw: Math.atan2(
            stack.position.x - position.x,
            stack.position.z - position.z,
        ),
        id: `cover-${block.id}`,
        position,
    } satisfies FarmAnimalTarget;
}

function createFarmAnimalHabitats({
    blockData,
    config,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    config: FarmAnimalConfig;
    stacks: Stack[] | undefined;
}) {
    const blockedCells = createAnimalBlockedCells(stacks);
    const groundSurfaces = createAnimalMovementSurfaces({
        blockData,
        groundLift: config.groundLift,
        stacks,
        swimDepth: config.swimDepth,
    });
    const covers: FarmAnimalTarget[] = [];
    const dustBaths: FarmAnimalTarget[] = [];
    const homes: Array<{
        home: FarmAnimalTarget;
        wallow: FarmAnimalTarget | null;
    }> = [];
    const roamAnchors: FarmAnimalTarget[] = [];

    for (const stack of stacks ?? []) {
        for (const block of stack.blocks) {
            if (block.name === config.homeBlockName) {
                homes.push({
                    home: targetForHomeBlock({
                        block,
                        blockData,
                        config,
                        stack,
                    }),
                    wallow:
                        config.species === 'Piglet'
                            ? targetForWallow({
                                  block,
                                  blockData,
                                  config,
                                  stack,
                              })
                            : null,
                });
            }
        }

        const topBlock = stack.blocks.at(-1);
        if (!topBlock) {
            continue;
        }
        if (treeBlockNames.has(topBlock.name)) {
            covers.push(
                targetForCover({ block: topBlock, blockData, config, stack }),
            );
            continue;
        }
        if (
            stack.blocks.length === 1 &&
            isAnimalGroundBlockName(topBlock.name)
        ) {
            roamAnchors.push(
                targetForGroundStack({
                    behavior: 'roam',
                    blockData,
                    config,
                    stack,
                }),
            );
            if (isDustBathGround(topBlock.name)) {
                dustBaths.push(
                    targetForGroundStack({
                        behavior: 'dust-bathe',
                        blockData,
                        config,
                        stack,
                    }),
                );
            }
        }
    }

    return homes.map(
        ({ home, wallow }) =>
            ({
                blockedCells,
                covers,
                dustBaths,
                groundSurfaces,
                home,
                id: `${config.species.toLowerCase()}-${home.id}`,
                roamAnchors,
                seed: hashString(`${config.species}:${home.id}`),
                species: config.species,
                wallow,
            }) satisfies FarmAnimalHabitat,
    );
}

export function createFarmAnimalHabitatsForSpecies({
    blockData,
    species,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    species: FarmAnimalSpecies;
    stacks: Stack[] | undefined;
}) {
    return createFarmAnimalHabitats({
        blockData,
        config: species === 'Chicken' ? chickenConfig : pigletConfig,
        stacks,
    });
}

function pickCandidate<T>(candidates: T[], random: () => number) {
    if (candidates.length === 0) {
        return null;
    }
    return candidates[Math.floor(random() * candidates.length)] ?? null;
}

function targetsInRange(
    targets: FarmAnimalTarget[],
    home: FarmAnimalTarget,
    range: number,
) {
    return targets.filter(
        (target) => horizontalDistance(target.position, home.position) <= range,
    );
}

function withBehaviorAndJitter({
    behavior,
    habitat,
    random,
    target,
}: {
    behavior: FarmAnimalBehavior;
    habitat: FarmAnimalHabitat;
    random: () => number;
    target: FarmAnimalTarget;
}) {
    if (behavior === 'home' || behavior === 'cover' || behavior === 'wallow') {
        return { ...target, behavior } satisfies FarmAnimalTarget;
    }

    const angle = random() * fullTurn;
    const radius = 0.08 + random() * 0.16;
    const position = target.position
        .clone()
        .add(
            new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
        );
    position.y = getAnimalMovementYAt(position, habitat.groundSurfaces);
    if (!canAnimalSettleAt(position, habitat.groundSurfaces)) {
        position.copy(target.position);
    }
    return {
        behavior,
        facingYaw: angle,
        id: `${behavior}-${target.id}-${Math.round(angle * 1000)}`,
        position,
    } satisfies FarmAnimalTarget;
}

export function getFarmAnimalBehaviorAvailability(
    habitat: FarmAnimalHabitat,
    range: number,
) {
    return {
        cover: targetsInRange(habitat.covers, habitat.home, range).length > 0,
        'dust-bathe':
            targetsInRange(habitat.dustBaths, habitat.home, range).length > 0,
        forage:
            targetsInRange(habitat.roamAnchors, habitat.home, range).length > 0,
        roam:
            targetsInRange(habitat.roamAnchors, habitat.home, range).length > 0,
        root:
            targetsInRange(habitat.roamAnchors, habitat.home, range).length > 0,
        wallow: habitat.wallow !== null,
    } satisfies FarmAnimalBehaviorAvailability;
}

function targetForBehavior({
    behavior,
    habitat,
    random,
    range,
}: {
    behavior: FarmAnimalBehavior;
    habitat: FarmAnimalHabitat;
    random: () => number;
    range: number;
}) {
    if (behavior === 'home') {
        return habitat.home;
    }
    if (behavior === 'wallow' && habitat.wallow) {
        return habitat.wallow;
    }
    if (behavior === 'cover') {
        return (
            pickCandidate(
                targetsInRange(habitat.covers, habitat.home, range),
                random,
            ) ?? habitat.home
        );
    }

    const candidates =
        behavior === 'dust-bathe'
            ? targetsInRange(habitat.dustBaths, habitat.home, range)
            : targetsInRange(habitat.roamAnchors, habitat.home, range);
    const target = pickCandidate(candidates, random);
    if (!target) {
        return habitat.home;
    }
    return withBehaviorAndJitter({ behavior, habitat, random, target });
}

export function chooseNextFarmAnimalTarget({
    forcedBehavior,
    habitat,
    random,
    timeOfDay,
    weather,
}: {
    forcedBehavior?: FarmAnimalBehavior;
    habitat: FarmAnimalHabitat;
    random: () => number;
    timeOfDay: number;
    weather: FarmAnimalWeather | null | undefined;
}) {
    const range = getFarmAnimalActivityRange({
        species: habitat.species,
        timeOfDay,
        weather,
    });
    const behavior =
        forcedBehavior ??
        pickFarmAnimalBehavior({
            availability: getFarmAnimalBehaviorAvailability(habitat, range),
            random,
            species: habitat.species,
            timeOfDay,
            weather,
        });
    return targetForBehavior({ behavior, habitat, random, range });
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
    if (!first) {
        return new Vector3();
    }
    if (distance <= 0) {
        return first.clone();
    }
    let remaining = distance;
    for (let index = 1; index < path.length; index += 1) {
        const from = path[index - 1];
        const to = path[index];
        if (!from || !to) {
            continue;
        }
        const segment = horizontalDistance(from, to);
        if (remaining <= segment) {
            return from
                .clone()
                .lerp(to, segment <= 0 ? 1 : remaining / segment);
        }
        remaining -= segment;
    }
    return path.at(-1)?.clone() ?? first.clone();
}

function makeMovingState({
    config,
    habitat,
    from,
    now,
    target,
}: {
    config: FarmAnimalConfig;
    habitat: FarmAnimalHabitat;
    from: Vector3;
    now: number;
    target: FarmAnimalTarget;
}) {
    const walkFrom = from.clone();
    const walkTo = target.position.clone();
    walkFrom.y = getAnimalMovementYAt(walkFrom, habitat.groundSurfaces);
    walkTo.y = getAnimalMovementYAt(walkTo, habitat.groundSurfaces);
    const pathfinding = findCatPath({
        blockedCells: habitat.blockedCells,
        from: walkFrom,
        surfaces: habitat.groundSurfaces,
        to: walkTo,
    });
    if (pathfinding.status === 'unreachable') {
        return null;
    }
    const path = pathfinding.points.map(
        (point) => new Vector3(point.x, point.y, point.z),
    );
    const pathDistance = Math.max(
        pathfinding.distance,
        pathHorizontalDistance(path),
    );
    return {
        duration: MathUtils.clamp(pathDistance / config.walkSpeed, 0.55, 9),
        groundSurfaces: habitat.groundSurfaces,
        path,
        pathDistance,
        pathfinding,
        phase: 'moving',
        startedAt: now,
        target,
        to: walkTo,
    } satisfies MovingFarmAnimalState;
}

function makeSettledState({
    habitat,
    now,
    random,
    target,
    timeOfDay,
    weather,
}: {
    habitat: FarmAnimalHabitat;
    now: number;
    random: () => number;
    target: FarmAnimalTarget;
    timeOfDay: number;
    weather: FarmAnimalWeather | null | undefined;
}) {
    return {
        dwellUntil:
            now +
            getFarmAnimalDwellSeconds({
                behavior: target.behavior,
                random,
                species: habitat.species,
                timeOfDay,
                weather,
            }),
        phase: 'settled',
        target,
    } satisfies SettledFarmAnimalState;
}

export function resolveFarmAnimalRuntimeForTarget({
    from,
    habitat,
    now,
    random,
    target,
    timeOfDay,
    weather,
}: {
    from: Vector3;
    habitat: FarmAnimalHabitat;
    now: number;
    random: () => number;
    target: FarmAnimalTarget;
    timeOfDay: number;
    weather: FarmAnimalWeather | null | undefined;
}) {
    if (from.distanceTo(target.position) < 0.08) {
        return makeSettledState({
            habitat,
            now,
            random,
            target,
            timeOfDay,
            weather,
        });
    }

    const config = habitat.species === 'Chicken' ? chickenConfig : pigletConfig;
    const moving = makeMovingState({
        config,
        habitat,
        from,
        now,
        target,
    });
    if (moving) {
        return moving;
    }

    return makeSettledState({
        habitat,
        now,
        random,
        target: {
            ...habitat.home,
            id: `safe-${habitat.home.id}`,
            position: from.clone(),
        },
        timeOfDay,
        weather,
    });
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
    group.rotation.y += difference * (1 - Math.exp(-8 * delta));
}

function getRigNode(root: Object3D, name: string) {
    const object = root.getObjectByName(name) ?? null;
    return {
        basePositionY: object?.position.y ?? 0,
        baseRotationX: object?.rotation.x ?? 0,
        baseRotationY: object?.rotation.y ?? 0,
        baseRotationZ: object?.rotation.z ?? 0,
        object,
    } satisfies RigNode;
}

function createFarmAnimalRig(root: Object3D, species: FarmAnimalSpecies) {
    if (species === 'Chicken') {
        return {
            body: getRigNode(root, 'Chicken_BodyPivot'),
            ears: [],
            head: getRigNode(root, 'Chicken_HeadPivot'),
            legs: [
                getRigNode(root, 'Chicken_LegPivot_L'),
                getRigNode(root, 'Chicken_LegPivot_R'),
            ],
            tail: getRigNode(root, 'Chicken_TailPivot'),
            walkPhase: 0,
            walkPoseAmount: 0,
            wings: [
                getRigNode(root, 'Chicken_WingPivot_L'),
                getRigNode(root, 'Chicken_WingPivot_R'),
            ],
        } satisfies FarmAnimalRig;
    }
    return {
        body: getRigNode(root, 'Piglet_BodyPivot'),
        ears: [
            getRigNode(root, 'Piglet_EarPivot_L'),
            getRigNode(root, 'Piglet_EarPivot_R'),
        ],
        head: getRigNode(root, 'Piglet_HeadPivot'),
        legs: [
            getRigNode(root, 'Piglet_LegPivot_FL'),
            getRigNode(root, 'Piglet_LegPivot_FR'),
            getRigNode(root, 'Piglet_LegPivot_RL'),
            getRigNode(root, 'Piglet_LegPivot_RR'),
        ],
        tail: getRigNode(root, 'Piglet_TailPivot'),
        walkPhase: 0,
        walkPoseAmount: 0,
        wings: [],
    } satisfies FarmAnimalRig;
}

function poseRigNode(
    node: RigNode | undefined,
    delta: number,
    offsets: {
        positionY?: number;
        rotationX?: number;
        rotationY?: number;
        rotationZ?: number;
    } = {},
) {
    if (!node?.object) {
        return;
    }
    node.object.position.y = MathUtils.damp(
        node.object.position.y,
        node.basePositionY + (offsets.positionY ?? 0),
        11,
        delta,
    );
    node.object.rotation.x = MathUtils.damp(
        node.object.rotation.x,
        node.baseRotationX + (offsets.rotationX ?? 0),
        11,
        delta,
    );
    node.object.rotation.y = MathUtils.damp(
        node.object.rotation.y,
        node.baseRotationY + (offsets.rotationY ?? 0),
        11,
        delta,
    );
    node.object.rotation.z = MathUtils.damp(
        node.object.rotation.z,
        node.baseRotationZ + (offsets.rotationZ ?? 0),
        11,
        delta,
    );
}

export function getFarmAnimalLocomotion({
    groundSurfaces,
    moving,
    position,
}: {
    groundSurfaces: AnimalMovementSurface[];
    moving: boolean;
    position: Pick<Vector3, 'x' | 'z'>;
}) {
    if (!moving) {
        return 'settled' as const;
    }
    return isAnimalSwimmingAt(position, groundSurfaces)
        ? ('swimming' as const)
        : ('walking' as const);
}

function updateChickenPose({
    behavior,
    delta,
    moving,
    now,
    rig,
    swimming,
    walkDistance,
}: {
    behavior: FarmAnimalBehavior;
    delta: number;
    moving: boolean;
    now: number;
    rig: FarmAnimalRig;
    swimming: boolean;
    walkDistance: number;
}) {
    rig.walkPoseAmount = MathUtils.damp(
        rig.walkPoseAmount,
        moving ? 1 : 0,
        10,
        delta,
    );
    if (moving) {
        rig.walkPhase =
            (walkDistance / chickenConfig.walkCycleDistance) * fullTurn;
    }
    const walkAmount = rig.walkPoseAmount;
    const step = Math.sin(rig.walkPhase);
    poseRigNode(rig.legs[0], delta, {
        rotationX: (swimming ? -0.42 + step * 0.3 : step * 0.52) * walkAmount,
    });
    poseRigNode(rig.legs[1], delta, {
        rotationX: (swimming ? -0.42 - step * 0.3 : -step * 0.52) * walkAmount,
    });

    const peck =
        behavior === 'forage' && !moving
            ? Math.max(0, Math.sin(now * 5.8)) ** 2
            : 0;
    const dust = behavior === 'dust-bathe' && !moving ? 1 : 0;
    poseRigNode(rig.body, delta, {
        positionY: swimming
            ? 0.018 + Math.sin(now * 5.5) * 0.01
            : moving
              ? Math.max(0, Math.sin(rig.walkPhase * 2)) * 0.025
              : 0,
        rotationX: swimming ? -0.08 : 0,
        rotationZ: dust * Math.sin(now * 3.2) * 0.16,
    });
    poseRigNode(rig.head, delta, {
        rotationX: peck * 0.78 + dust * 0.28 + (swimming ? -0.12 : 0),
        rotationZ:
            behavior === 'roam' && !moving ? Math.sin(now * 1.7) * 0.16 : 0,
    });
    poseRigNode(rig.wings[0], delta, {
        rotationZ: swimming
            ? -0.3 - Math.sin(now * 8.5) * 0.22
            : dust * (-0.38 - Math.sin(now * 10) * 0.3),
    });
    poseRigNode(rig.wings[1], delta, {
        rotationZ: swimming
            ? 0.3 + Math.sin(now * 8.5) * 0.22
            : dust * (0.38 + Math.sin(now * 10) * 0.3),
    });
    poseRigNode(rig.tail, delta, {
        rotationX: moving ? Math.sin(rig.walkPhase) * 0.08 : 0,
    });
}

function updatePigletPose({
    behavior,
    delta,
    moving,
    now,
    rig,
    swimming,
    walkDistance,
}: {
    behavior: FarmAnimalBehavior;
    delta: number;
    moving: boolean;
    now: number;
    rig: FarmAnimalRig;
    swimming: boolean;
    walkDistance: number;
}) {
    rig.walkPoseAmount = MathUtils.damp(
        rig.walkPoseAmount,
        moving ? 1 : 0,
        9,
        delta,
    );
    if (moving) {
        rig.walkPhase =
            (walkDistance / pigletConfig.walkCycleDistance) * fullTurn;
    }
    const amount = rig.walkPoseAmount;
    const diagonal =
        Math.sin(rig.walkPhase) * (swimming ? 0.62 : 0.42) * amount;
    rig.legs.forEach((leg, index) => {
        poseRigNode(leg, delta, {
            rotationX:
                (swimming ? -0.28 : 0) +
                (index === 0 || index === 3 ? diagonal : -diagonal),
        });
    });
    const rooting = behavior === 'root' && !moving ? 1 : 0;
    const wallowing = behavior === 'wallow' && !moving ? 1 : 0;
    poseRigNode(rig.body, delta, {
        positionY: swimming
            ? 0.025 + Math.sin(now * 5) * 0.012
            : moving
              ? Math.max(0, Math.sin(rig.walkPhase * 2)) * 0.018
              : 0,
        rotationX: swimming ? -0.06 : 0,
        rotationZ: wallowing * Math.sin(now * 2.1) * 0.2,
    });
    poseRigNode(rig.head, delta, {
        rotationX:
            rooting * (0.32 + Math.max(0, Math.sin(now * 4.6)) * 0.24) +
            wallowing * 0.12 +
            (swimming ? -0.1 : 0),
        rotationZ:
            !moving && behavior === 'roam' ? Math.sin(now * 1.5) * 0.1 : 0,
    });
    rig.ears.forEach((ear, index) => {
        poseRigNode(ear, delta, {
            rotationZ: Math.sin(now * 4.2 + index * Math.PI) * 0.11,
        });
    });
    poseRigNode(rig.tail, delta, {
        rotationY: Math.sin(now * (moving ? 9 : 5.5)) * (moving ? 0.45 : 0.25),
    });
}

function roundCoordinate(value: number) {
    return Math.round(value * 100) / 100;
}

function roundPoint(point: Vector3) {
    return {
        x: roundCoordinate(point.x),
        y: roundCoordinate(point.y),
        z: roundCoordinate(point.z),
    };
}

function debugPathPoint(point: Vector3) {
    return [
        roundCoordinate(point.x),
        roundCoordinate(point.y),
        roundCoordinate(point.z),
    ] satisfies AnimalDebugPathPoint;
}

function debugPathKey(path: Vector3[]) {
    return path.map((point) => debugPathPoint(point).join(':')).join('|');
}

function isSpeciesBehavior(
    species: FarmAnimalSpecies,
    behavior: string,
): behavior is FarmAnimalBehavior {
    return species === 'Chicken'
        ? ['home', 'roam', 'forage', 'dust-bathe', 'cover'].includes(behavior)
        : ['home', 'roam', 'root', 'wallow', 'cover'].includes(behavior);
}

function FarmAnimal({
    config,
    habitat,
    weather,
}: {
    config: FarmAnimalConfig;
    habitat: FarmAnimalHabitat;
    weather: FarmAnimalWeather | null | undefined;
}) {
    const gltf = useGameGLTF(config.assetName);
    const { enableDebugHudFlag = false } = useGameFlags();
    const clock = useThree((state) => state.clock);
    const gameStateStore = useGameStateStore();
    const groupRef = useRef<Group>(null);
    const targetDebugRef = useRef<Group>(null);
    const runtimeRef = useRef<FarmAnimalRuntimeState | null>(null);
    const randomRef = useRef(createRandom(habitat.seed));
    const lastPresenceUpdateRef = useRef(0);
    const lastDebugUpdateRef = useRef(0);
    const lastPetRequestSequenceRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const followAvatarUntilRef = useRef(Number.NEGATIVE_INFINITY);
    const nextFollowRepathAtRef = useRef(Number.NEGATIVE_INFINITY);
    const debugPathKeyRef = useRef('');
    const [pathDebugPoints, setPathDebugPoints] = useState<
        AnimalDebugPathPoint[]
    >([]);
    const { message: speechMessage, showMessage: showSpeechMessage } =
        useActorHoverSpeech(config.speechMessages);
    const timeOfDay = useGameState((state) => state.timeOfDay);
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

    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        const { primaryCasterCount } = configureActorMeshShadows(
            scene,
            (mesh: Mesh) => {
                mesh.frustumCulled = false;
                mesh.receiveShadow = true;
            },
        );
        return {
            primaryCasterCount,
            rig: createFarmAnimalRig(scene, habitat.species),
            scene,
        };
    }, [gltf.scene, habitat.species]);
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: `${config.shadowSpecies}:${habitat.id}`,
        primaryCasterCount: model.primaryCasterCount,
        species: config.shadowSpecies,
    });

    useEffect(() => {
        runtimeRef.current = null;
        groupRef.current?.position.copy(habitat.home.position);
        if (groupRef.current && habitat.home.facingYaw !== undefined) {
            groupRef.current.rotation.y = habitat.home.facingYaw;
        }
    }, [habitat.home.facingYaw, habitat.home.position]);

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
        if (!animalPathfindingDebugVisible) {
            debugPathKeyRef.current = '';
            setPathDebugPoints([]);
        }
    }, [animalPathfindingDebugVisible]);

    function syncDebugIndicators(runtime: FarmAnimalRuntimeState | null) {
        const targetDebug = targetDebugRef.current;
        if (targetDebug) {
            targetDebug.visible = animalTargetsDebugVisible && runtime !== null;
            if (targetDebug.visible && runtime) {
                targetDebug.position.copy(runtime.target.position);
            }
        }
        const key =
            animalPathfindingDebugVisible && runtime?.phase === 'moving'
                ? debugPathKey(runtime.path)
                : '';
        if (key !== debugPathKeyRef.current) {
            debugPathKeyRef.current = key;
            setPathDebugPoints(
                animalPathfindingDebugVisible && runtime?.phase === 'moving'
                    ? runtime.path.map(debugPathPoint)
                    : [],
            );
        }
    }

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
        if (!group) {
            return;
        }
        const now = clock.getElapsedTime();
        const target = chooseNextFarmAnimalTarget({
            habitat,
            random: randomRef.current,
            timeOfDay,
            weather,
        });
        runtimeRef.current = resolveFarmAnimalRuntimeForTarget({
            from: group.position,
            habitat,
            now,
            random: randomRef.current,
            target,
            timeOfDay,
            weather,
        });
    }

    useFrame(({ clock: frameClock }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }
        const now = frameClock.elapsedTime;
        const random = randomRef.current;
        let runtime = runtimeRef.current;
        if (!runtime) {
            runtime = makeSettledState({
                habitat,
                now,
                random,
                target: habitat.home,
                timeOfDay,
                weather,
            });
            runtimeRef.current = runtime;
            group.position.copy(habitat.home.position);
            group.rotation.y = habitat.home.facingYaw ?? 0;
        }

        const { gardenAvatarAnimalPetRequest, gardenAvatarPresence } =
            gameStateStore.getState();
        if (
            gardenAvatarAnimalPetRequest &&
            gardenAvatarAnimalPetRequest.sequence !==
                lastPetRequestSequenceRef.current
        ) {
            lastPetRequestSequenceRef.current =
                gardenAvatarAnimalPetRequest.sequence;
            if (
                gardenAvatarAnimalPetRequest.species === habitat.species &&
                gardenAvatarAnimalPetRequest.targetId === habitat.id
            ) {
                followAvatarUntilRef.current = now + animalAvatarFollowSeconds;
                nextFollowRepathAtRef.current = Number.NEGATIVE_INFINITY;
            }
        }

        const canFollowAvatar =
            now < followAvatarUntilRef.current &&
            !isFarmAnimalNight(timeOfDay) &&
            !isFarmAnimalAdverseWeather(habitat.species, weather) &&
            isFreshGardenAvatarPresence(gardenAvatarPresence, now);
        if (canFollowAvatar && now >= nextFollowRepathAtRef.current) {
            const position =
                getAnimalAvatarFollowPosition(gardenAvatarPresence);
            position.y = getAnimalMovementYAt(position, habitat.groundSurfaces);
            const target = {
                behavior: 'follow-avatar',
                id: `avatar-follow-${habitat.id}`,
                lookAtPosition: new Vector3(
                    gardenAvatarPresence.position.x,
                    gardenAvatarPresence.position.y + 0.75,
                    gardenAvatarPresence.position.z,
                ),
                position,
            } satisfies FarmAnimalTarget;
            runtime = resolveFarmAnimalRuntimeForTarget({
                from: group.position,
                habitat,
                now,
                random,
                target,
                timeOfDay,
                weather,
            });
            runtimeRef.current = runtime;
            nextFollowRepathAtRef.current =
                now + animalAvatarFollowRepathSeconds;
        }

        if (
            animalDebugCommand &&
            animalDebugCommand.sequence !==
                lastDebugCommandSequenceRef.current &&
            animalDebugCommand.species === habitat.species
        ) {
            lastDebugCommandSequenceRef.current = animalDebugCommand.sequence;
            if (
                (!animalDebugCommand.targetId ||
                    animalDebugCommand.targetId === habitat.id) &&
                isSpeciesBehavior(habitat.species, animalDebugCommand.behavior)
            ) {
                const target = chooseNextFarmAnimalTarget({
                    forcedBehavior: animalDebugCommand.behavior,
                    habitat,
                    random,
                    timeOfDay,
                    weather,
                });
                runtime = resolveFarmAnimalRuntimeForTarget({
                    from: group.position,
                    habitat,
                    now,
                    random,
                    target,
                    timeOfDay,
                    weather,
                });
                runtimeRef.current = runtime;
            }
        }

        syncDebugIndicators(runtime);
        let walkDistance = 0;
        if (runtime.phase === 'moving') {
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            walkDistance = runtime.pathDistance * progress;
            const nextPosition = pathPositionAtDistance(
                runtime.path,
                walkDistance,
            );
            nextPosition.y = getAnimalMovementYAt(
                nextPosition,
                runtime.groundSurfaces,
            );
            nextPosition.y +=
                Math.max(
                    0,
                    Math.sin(
                        (walkDistance / config.walkCycleDistance) *
                            fullTurn *
                            2,
                    ),
                ) * 0.012;
            group.position.copy(nextPosition);
            facePosition(
                group,
                pathPositionAtDistance(
                    runtime.path,
                    Math.min(runtime.pathDistance, walkDistance + 0.08),
                ),
                delta,
            );
            if (progress >= 1) {
                group.position.copy(runtime.to);
                runtime = makeSettledState({
                    habitat,
                    now,
                    random,
                    target: runtime.target,
                    timeOfDay,
                    weather,
                });
                runtimeRef.current = runtime;
            }
        } else {
            group.position.copy(runtime.target.position);
            if (runtime.target.lookAtPosition) {
                facePosition(group, runtime.target.lookAtPosition, delta);
            } else if (runtime.target.facingYaw !== undefined) {
                const lookAt = group.position
                    .clone()
                    .add(
                        new Vector3(
                            Math.sin(runtime.target.facingYaw),
                            0,
                            Math.cos(runtime.target.facingYaw),
                        ),
                    );
                facePosition(group, lookAt, delta);
            }

            const mustReturnHome =
                (isFarmAnimalNight(timeOfDay) ||
                    isFarmAnimalAdverseWeather(habitat.species, weather)) &&
                runtime.target.behavior !== 'home';
            if (mustReturnHome || now >= runtime.dwellUntil) {
                const target = chooseNextFarmAnimalTarget({
                    forcedBehavior: mustReturnHome ? 'home' : undefined,
                    habitat,
                    random,
                    timeOfDay,
                    weather,
                });
                runtimeRef.current = resolveFarmAnimalRuntimeForTarget({
                    from: group.position,
                    habitat,
                    now,
                    random,
                    target,
                    timeOfDay,
                    weather,
                });
            }
        }

        const activeRuntime = runtimeRef.current ?? runtime;
        const locomotion = getFarmAnimalLocomotion({
            groundSurfaces: habitat.groundSurfaces,
            moving: activeRuntime.phase === 'moving',
            position: group.position,
        });
        if (habitat.species === 'Chicken') {
            updateChickenPose({
                behavior: activeRuntime.target.behavior,
                delta,
                moving: activeRuntime.phase === 'moving',
                now,
                rig: model.rig,
                swimming: locomotion === 'swimming',
                walkDistance,
            });
        } else {
            updatePigletPose({
                behavior: activeRuntime.target.behavior,
                delta,
                moving: activeRuntime.phase === 'moving',
                now,
                rig: model.rig,
                swimming: locomotion === 'swimming',
                walkDistance,
            });
        }
    });

    useFrame(({ clock: frameClock }) => {
        const group = groupRef.current;
        const runtime = runtimeRef.current;
        if (!group || !runtime) {
            return;
        }
        const now = frameClock.elapsedTime;
        updateActorGroundingShadow?.({
            actorY: group.position.y,
            receiverY: getAnimalMovementYAt(
                group.position,
                habitat.groundSurfaces,
            ),
            visible: group.visible && model.scene.visible,
            x: group.position.x,
            yaw: group.rotation.y,
            z: group.position.z,
        });
        if (
            now - lastPresenceUpdateRef.current >=
            animalPresenceUpdateIntervalSeconds
        ) {
            lastPresenceUpdateRef.current = now;
            setAnimalPresenceEntry({
                behavior: runtime.target.behavior,
                id: habitat.id,
                position: roundPoint(group.position),
                species: habitat.species,
                updatedAt: now,
            });
        }
        if (enableDebugHudFlag && now - lastDebugUpdateRef.current >= 0.5) {
            lastDebugUpdateRef.current = now;
            const locomotion = getFarmAnimalLocomotion({
                groundSurfaces: habitat.groundSurfaces,
                moving: runtime.phase === 'moving',
                position: group.position,
            });
            const debugBehaviors =
                habitat.species === 'Chicken'
                    ? ['home', 'roam', 'forage', 'dust-bathe', 'cover']
                    : ['home', 'roam', 'root', 'wallow', 'cover'];
            const entry = {
                activity:
                    runtime.phase === 'moving'
                        ? `${locomotion} to ${runtime.target.behavior}`
                        : runtime.target.behavior,
                behavior: runtime.target.behavior,
                debugBehaviors,
                id: habitat.id,
                label: habitat.home.id.replace(/^home-/, ''),
                pathfinding:
                    runtime.phase === 'moving'
                        ? {
                              blockedCellCount:
                                  runtime.pathfinding.blockedCellCount,
                              distance: roundCoordinate(runtime.pathDistance),
                              status: runtime.pathfinding.status,
                              targetCell: runtime.pathfinding.targetCell,
                              visitedCellCount:
                                  runtime.pathfinding.visitedCellCount,
                              waypointCount: runtime.path.length,
                          }
                        : undefined,
                phase: runtime.phase,
                position: roundPoint(group.position),
                species: habitat.species,
                targetId: runtime.target.id,
                updatedAt: now,
            } satisfies AnimalDebugEntry;
            setAnimalDebugEntry(entry);
        }
    });

    return (
        <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js actor is interactive */}
            <group
                ref={groupRef}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
                onPointerOver={handlePointerOver}
                scale={config.scale}
            >
                <primitive object={model.scene} />
            </group>
            <AnimalPetHearts
                actorRef={groupRef}
                offsetY={config.petHeartsOffsetY}
                targetId={habitat.id}
            />
            {speechMessage ? (
                <ActorSpeechBubble
                    actorRef={groupRef}
                    message={speechMessage}
                    offsetY={config.speechBubbleOffsetY}
                />
            ) : null}
            <AnimalTargetDebugMarker
                ref={targetDebugRef}
                color={config.debugColor}
            />
            <AnimalPathDebugIndicator
                color={config.debugColor}
                points={pathDebugPoints}
                visible={animalPathfindingDebugVisible}
            />
        </>
    );
}

function resolveFarmAnimalWeather({
    gameWeather,
    weatherDisabled,
    weatherNow,
    weatherOverride,
}: {
    gameWeather: GameState['weather'];
    weatherDisabled: boolean;
    weatherNow: FarmAnimalWeather | null | undefined;
    weatherOverride: FarmAnimalWeatherOverride | undefined;
}) {
    if (weatherDisabled) {
        return clearFarmAnimalWeather;
    }
    if (weatherOverride) {
        return { ...clearFarmAnimalWeather, ...weatherOverride };
    }
    if (!weatherNow && !gameWeather) {
        return undefined;
    }
    return { ...clearFarmAnimalWeather, ...weatherNow, ...gameWeather };
}

function FarmAnimalCollection({
    config,
    farmId,
    stacks,
    weather,
    weatherDisabled = false,
}: {
    config: FarmAnimalConfig;
    farmId?: number | null;
    stacks: Stack[] | undefined;
    weather?: FarmAnimalWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const { data: blockData } = useBlockData();
    const gameWeather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow(
        !weatherDisabled && !weather,
        farmId,
    );
    const resolvedWeather = resolveFarmAnimalWeather({
        gameWeather,
        weatherDisabled,
        weatherNow,
        weatherOverride: weather,
    });
    const habitats = useMemo(
        () =>
            createFarmAnimalHabitatsForSpecies({
                blockData,
                species: config.species,
                stacks,
            }),
        [blockData, config, stacks],
    );
    if (habitats.length === 0) {
        return null;
    }
    return habitats.map((habitat) => (
        <FarmAnimal
            key={habitat.id}
            config={config}
            habitat={habitat}
            weather={resolvedWeather}
        />
    ));
}

export function Chickens({
    farmId,
    stacks,
    weather,
    weatherDisabled = false,
}: {
    farmId?: number | null;
    stacks: Stack[] | undefined;
    weather?: FarmAnimalWeatherOverride;
    weatherDisabled?: boolean;
}) {
    return (
        <FarmAnimalCollection
            config={chickenConfig}
            farmId={farmId}
            stacks={stacks}
            weather={weather}
            weatherDisabled={weatherDisabled}
        />
    );
}

export function Piglets({
    farmId,
    stacks,
    weather,
    weatherDisabled = false,
}: {
    farmId?: number | null;
    stacks: Stack[] | undefined;
    weather?: FarmAnimalWeatherOverride;
    weatherDisabled?: boolean;
}) {
    return (
        <FarmAnimalCollection
            config={pigletConfig}
            farmId={farmId}
            stacks={stacks}
            weather={weather}
            weatherDisabled={weatherDisabled}
        />
    );
}
