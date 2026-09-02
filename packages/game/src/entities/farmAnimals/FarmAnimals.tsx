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
import { PickableGroup } from '../../controls/PickableGroup';
import { RotatableGroup } from '../../controls/RotatableGroup';
import { useGameFlags } from '../../GameFlagsContext';
import { useBlockData } from '../../hooks/useBlockData';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Block } from '../../types/Block';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
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
    goatSpeechMessages,
    pigletSpeechMessages,
    sheepSpeechMessages,
} from '../animals/actorSpeechMessages';
import {
    animalAvatarFollowDistance,
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
    getAnimalMovementSurfaceAt,
    getAnimalMovementYAt,
    isAnimalGroundBlockName,
    isAnimalSwimmingAt,
} from '../animals/animalMovementTerrain';
import {
    animalPresenceUpdateIntervalSeconds,
    freshAnimalPresences,
} from '../animals/animalPresence';
import { initializeAnimalAtHome } from '../animals/animalRuntimeLifecycle';
import {
    type CatPathCell,
    type CatPathResult,
    findCatPath,
} from '../cats/catPathfinding';
import {
    getPersistentPetHomePlacement,
    isPersistentPetHomeBlockName,
} from '../persistentPets/persistentPetHomes';
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
import {
    adjustSheepTargetForFlock,
    getSheepSeparationOffset,
    pickSheepLocomotion,
    type SheepLocomotion,
    scaleSheepSeparationOffset,
} from './sheepBehavior';

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
    homeBlock: Block;
    homeStack: Stack;
    id: string;
    rockyAnchors: FarmAnimalTarget[];
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
    sheepLocomotion?: SheepLocomotion;
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
    assetName: 'Chicken' | 'Goat' | 'Piglet' | 'Sheep';
    debugColor: string;
    groundLift: number;
    homeBlockName:
        | 'ChickenCoop'
        | 'Goat'
        | 'GoatShelter'
        | 'PigletPen'
        | 'Sheep'
        | 'SheepFold';
    homeDoorOffset: number;
    petHeartsOffsetY: number;
    scale: number;
    shadowSpecies: 'chicken' | 'goat' | 'piglet' | 'sheep';
    speechBubbleOffsetY: number;
    speechMessages: readonly string[];
    species: FarmAnimalSpecies;
    swimDepth: number;
    walkCycleDistance: number;
    walkSpeed: number;
    trotSpeed?: number;
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
    jaw: RigNode;
    legs: RigNode[];
    neck: RigNode;
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

const goatConfig = {
    assetName: 'Goat',
    debugColor: '#a78b67',
    groundLift: 0.024,
    homeBlockName: 'GoatShelter',
    homeDoorOffset: 0.48,
    petHeartsOffsetY: 0.72,
    scale: 0.392,
    shadowSpecies: 'goat',
    speechBubbleOffsetY: 0.8,
    speechMessages: goatSpeechMessages,
    species: 'Goat',
    swimDepth: 0.14,
    walkCycleDistance: 0.82,
    walkSpeed: 0.86,
} satisfies FarmAnimalConfig;

const legacyGoatConfig = {
    ...goatConfig,
    homeBlockName: 'Goat',
    homeDoorOffset: 0,
} satisfies FarmAnimalConfig;

const sheepConfig = {
    assetName: 'Sheep',
    debugColor: '#d6c7aa',
    groundLift: 0.025,
    homeBlockName: 'SheepFold',
    homeDoorOffset: 0.7,
    petHeartsOffsetY: 0.72,
    scale: 0.46,
    shadowSpecies: 'sheep',
    speechBubbleOffsetY: 0.82,
    speechMessages: sheepSpeechMessages,
    species: 'Sheep',
    swimDepth: 0,
    trotSpeed: 1.16,
    walkCycleDistance: 0.74,
    walkSpeed: 0.58,
} satisfies FarmAnimalConfig;

const legacySheepConfig = {
    ...sheepConfig,
    homeBlockName: 'Sheep',
    homeDoorOffset: 0,
} satisfies FarmAnimalConfig;

function getFarmAnimalConfig(species: FarmAnimalSpecies) {
    if (species === 'Chicken') {
        return chickenConfig;
    }
    if (species === 'Goat') {
        return goatConfig;
    }
    if (species === 'Piglet') {
        return pigletConfig;
    }
    return sheepConfig;
}

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

function isGoatPreferredGround(name: string) {
    return name.includes('Stone') || name.includes('Gravel');
}

function targetForHomeBlock({
    block,
    blockData,
    config,
    groundSurfaces,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    config: FarmAnimalConfig;
    groundSurfaces: AnimalMovementSurface[];
    stack: Stack;
}) {
    const placement = isPersistentPetHomeBlockName(block.name)
        ? getPersistentPetHomePlacement({
              blockName: block.name,
              rotation: block.rotation,
              x: stack.position.x,
              z: stack.position.z,
          })
        : null;
    const facingYaw =
        placement?.facingYaw ?? blockRotationToYaw(block.rotation);
    const homeAnchor = placement?.doorway ?? {
        x: stack.position.x + Math.sin(facingYaw) * config.homeDoorOffset,
        z: stack.position.z + Math.cos(facingYaw) * config.homeDoorOffset,
    };
    const homeSurface = getAnimalMovementSurfaceAt(homeAnchor, groundSurfaces);
    const groundY =
        homeSurface?.kind === 'ground'
            ? Math.max(config.groundLift, homeSurface.y)
            : Math.max(
                  0,
                  getStackHeight(blockData, stack, block) + config.groundLift,
              );
    const position = new Vector3(homeAnchor.x, groundY, homeAnchor.z);

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
    const radius =
        config.species === 'Goat'
            ? 0.72 + ((seed >>> 5) % 7) * 0.02
            : 0.28 + ((seed >>> 5) % 7) * 0.015;
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
    const blockedCells = createAnimalBlockedCells(stacks, { blockData });
    const groundSurfaces = createAnimalMovementSurfaces({
        blockData,
        groundLift: config.groundLift,
        stacks,
        swimDepth: config.swimDepth,
    }).filter(
        (surface) => config.species !== 'Sheep' || surface.kind === 'ground',
    );
    const covers: FarmAnimalTarget[] = [];
    const dustBaths: FarmAnimalTarget[] = [];
    const homes: Array<{
        home: FarmAnimalTarget;
        homeBlock: Block;
        homeStack: Stack;
        wallow: FarmAnimalTarget | null;
    }> = [];
    const rockyAnchors: FarmAnimalTarget[] = [];
    const roamAnchors: FarmAnimalTarget[] = [];

    for (const stack of stacks ?? []) {
        for (const block of stack.blocks) {
            if (block.name === config.homeBlockName) {
                homes.push({
                    home: targetForHomeBlock({
                        block,
                        blockData,
                        config,
                        groundSurfaces,
                        stack,
                    }),
                    homeBlock: block,
                    homeStack: stack,
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
            const cover = targetForCover({
                block: topBlock,
                blockData,
                config,
                stack,
            });
            const coverCellBlocked = blockedCells.some(
                (cell) =>
                    cell.x === Math.round(cover.position.x) &&
                    cell.z === Math.round(cover.position.z),
            );
            if (
                config.species !== 'Goat' ||
                (!coverCellBlocked &&
                    canAnimalSettleAt(cover.position, groundSurfaces))
            ) {
                covers.push(cover);
            }
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
            if (isGoatPreferredGround(topBlock.name)) {
                rockyAnchors.push(
                    targetForGroundStack({
                        behavior: 'roam',
                        blockData,
                        config,
                        stack,
                    }),
                );
            }
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
        ({ home, homeBlock, homeStack, wallow }) =>
            ({
                blockedCells,
                covers,
                dustBaths,
                groundSurfaces,
                home,
                homeBlock,
                homeStack,
                id: `${config.species.toLowerCase()}-${home.id}`,
                rockyAnchors,
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
        config: getFarmAnimalConfig(species),
        stacks,
    });
}

export function createLegacySheepHabitats({
    blockData,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: Stack[] | undefined;
}) {
    return createFarmAnimalHabitats({
        blockData,
        config: legacySheepConfig,
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
        browse:
            targetsInRange(habitat.roamAnchors, habitat.home, range).length > 0,
        chew:
            targetsInRange(habitat.roamAnchors, habitat.home, range).length > 0,
        cover: targetsInRange(habitat.covers, habitat.home, range).length > 0,
        'dust-bathe':
            targetsInRange(habitat.dustBaths, habitat.home, range).length > 0,
        forage:
            targetsInRange(habitat.roamAnchors, habitat.home, range).length > 0,
        'chew-cud':
            targetsInRange(habitat.roamAnchors, habitat.home, range).length > 0,
        graze:
            targetsInRange(habitat.roamAnchors, habitat.home, range).length > 0,
        'play-hop':
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
            : habitat.species === 'Goat' &&
                (behavior === 'browse' || behavior === 'play-hop') &&
                targetsInRange(habitat.rockyAnchors, habitat.home, range)
                    .length > 0
              ? targetsInRange(habitat.rockyAnchors, habitat.home, range)
              : targetsInRange(habitat.roamAnchors, habitat.home, range);
    const target = pickCandidate(candidates, random);
    if (!target) {
        return habitat.home;
    }
    return withBehaviorAndJitter({ behavior, habitat, random, target });
}

const goatCuriosityMaxDistance = 3.6;
const goatCuriosityApproachThreshold = 1.45;
const goatCuriosityRetreatThreshold = 0.72;
const goatCuriosityComfortDistance = 1.08;
const goatCuriosityRetreatDistance = 1.32;

function goatCuriosityPosition({
    avatarPosition,
    distance,
    goatPosition,
    habitat,
}: {
    avatarPosition: Pick<Vector3, 'x' | 'y' | 'z'>;
    distance: number;
    goatPosition: Pick<Vector3, 'x' | 'y' | 'z'>;
    habitat: FarmAnimalHabitat;
}) {
    const direction = new Vector3(
        goatPosition.x - avatarPosition.x,
        0,
        goatPosition.z - avatarPosition.z,
    );
    if (direction.lengthSq() <= 0.0001) {
        direction.set(0, 0, 1);
    }
    direction.normalize();
    const radii = [distance, distance + 0.18, Math.max(0.82, distance - 0.14)];
    const angleOffsets = [
        0,
        Math.PI / 5,
        -Math.PI / 5,
        Math.PI / 2,
        -Math.PI / 2,
    ];
    const blockedKeys = new Set(
        habitat.blockedCells.map((cell) => `${cell.x}:${cell.z}`),
    );

    for (const radius of radii) {
        for (const angle of angleOffsets) {
            const candidateDirection = direction
                .clone()
                .applyAxisAngle(new Vector3(0, 1, 0), angle);
            const candidate = new Vector3(
                avatarPosition.x + candidateDirection.x * radius,
                goatPosition.y,
                avatarPosition.z + candidateDirection.z * radius,
            );
            candidate.y = getAnimalMovementYAt(
                candidate,
                habitat.groundSurfaces,
            );
            const candidateKey = `${Math.round(candidate.x)}:${Math.round(candidate.z)}`;
            if (
                !blockedKeys.has(candidateKey) &&
                canAnimalSettleAt(candidate, habitat.groundSurfaces)
            ) {
                return candidate;
            }
        }
    }

    return null;
}

export function getGoatCuriosityTarget({
    avatarPosition,
    goatPosition,
    habitat,
}: {
    avatarPosition: Pick<Vector3, 'x' | 'y' | 'z'>;
    goatPosition: Pick<Vector3, 'x' | 'y' | 'z'>;
    habitat: FarmAnimalHabitat;
}) {
    if (habitat.species !== 'Goat') {
        return null;
    }

    const distance = horizontalDistance(avatarPosition, goatPosition);
    const behavior =
        distance < goatCuriosityRetreatThreshold
            ? ('retreat-avatar' as const)
            : distance > goatCuriosityApproachThreshold &&
                distance <= goatCuriosityMaxDistance
              ? ('approach-avatar' as const)
              : null;
    if (!behavior) {
        return null;
    }

    const position = goatCuriosityPosition({
        avatarPosition,
        distance:
            behavior === 'retreat-avatar'
                ? goatCuriosityRetreatDistance
                : goatCuriosityComfortDistance,
        goatPosition,
        habitat,
    });
    if (!position) {
        return null;
    }

    return {
        behavior,
        id: `${behavior}-${habitat.id}`,
        lookAtPosition: new Vector3(
            avatarPosition.x,
            avatarPosition.y + 0.72,
            avatarPosition.z,
        ),
        position,
    } satisfies FarmAnimalTarget;
}

export function canGoatStartCuriosity({
    avatarDistance,
    canFollowAvatar,
    freshAvatar,
    nextCuriosityAt,
    now,
    phase,
    species,
    targetBehavior,
    timeOfDay,
    weather,
}: {
    avatarDistance: number;
    canFollowAvatar: boolean;
    freshAvatar: boolean;
    nextCuriosityAt: number;
    now: number;
    phase: FarmAnimalRuntimeState['phase'];
    species: FarmAnimalSpecies;
    targetBehavior: FarmAnimalBehavior;
    timeOfDay: number;
    weather: FarmAnimalWeather | null | undefined;
}) {
    if (
        canFollowAvatar ||
        !freshAvatar ||
        species !== 'Goat' ||
        now < nextCuriosityAt ||
        isFarmAnimalNight(timeOfDay) ||
        isFarmAnimalAdverseWeather(species, weather) ||
        (phase === 'moving' &&
            (targetBehavior === 'home' || targetBehavior === 'retreat-avatar'))
    ) {
        return false;
    }

    return (
        avatarDistance < goatCuriosityRetreatThreshold || phase === 'settled'
    );
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
    random,
    target,
}: {
    config: FarmAnimalConfig;
    habitat: FarmAnimalHabitat;
    from: Vector3;
    now: number;
    random: () => number;
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
    const sheepLocomotion =
        habitat.species === 'Sheep'
            ? pickSheepLocomotion({ distance: pathDistance, random })
            : undefined;
    const movementSpeed =
        sheepLocomotion === 'trot'
            ? (config.trotSpeed ?? config.walkSpeed)
            : config.walkSpeed;
    return {
        duration: MathUtils.clamp(pathDistance / movementSpeed, 0.55, 9),
        groundSurfaces: habitat.groundSurfaces,
        path,
        pathDistance,
        pathfinding,
        phase: 'moving',
        sheepLocomotion,
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

    const config = getFarmAnimalConfig(habitat.species);
    const moving = makeMovingState({
        config,
        habitat,
        from,
        now,
        random,
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

function getRigNode(root: Object3D, name: string | null) {
    const object = name ? (root.getObjectByName(name) ?? null) : null;
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
            jaw: getRigNode(root, null),
            legs: [
                getRigNode(root, 'Chicken_LegPivot_L'),
                getRigNode(root, 'Chicken_LegPivot_R'),
            ],
            neck: getRigNode(root, null),
            tail: getRigNode(root, 'Chicken_TailPivot'),
            walkPhase: 0,
            walkPoseAmount: 0,
            wings: [
                getRigNode(root, 'Chicken_WingPivot_L'),
                getRigNode(root, 'Chicken_WingPivot_R'),
            ],
        } satisfies FarmAnimalRig;
    }
    if (species === 'Goat') {
        return {
            body: getRigNode(root, 'Goat_BodyPivot'),
            ears: [
                getRigNode(root, 'Goat_EarPivot_L'),
                getRigNode(root, 'Goat_EarPivot_R'),
            ],
            head: getRigNode(root, 'Goat_HeadPivot'),
            jaw: getRigNode(root, 'Goat_JawPivot'),
            legs: [
                getRigNode(root, 'Goat_LegPivot_FL'),
                getRigNode(root, 'Goat_LegPivot_FR'),
                getRigNode(root, 'Goat_LegPivot_RL'),
                getRigNode(root, 'Goat_LegPivot_RR'),
            ],
            neck: getRigNode(root, 'Goat_NeckPivot'),
            tail: getRigNode(root, 'Goat_TailPivot'),
            walkPhase: 0,
            walkPoseAmount: 0,
            wings: [],
        } satisfies FarmAnimalRig;
    }
    if (species === 'Piglet') {
        return {
            body: getRigNode(root, 'Piglet_BodyPivot'),
            ears: [
                getRigNode(root, 'Piglet_EarPivot_L'),
                getRigNode(root, 'Piglet_EarPivot_R'),
            ],
            head: getRigNode(root, 'Piglet_HeadPivot'),
            jaw: getRigNode(root, null),
            legs: [
                getRigNode(root, 'Piglet_LegPivot_FL'),
                getRigNode(root, 'Piglet_LegPivot_FR'),
                getRigNode(root, 'Piglet_LegPivot_RL'),
                getRigNode(root, 'Piglet_LegPivot_RR'),
            ],
            neck: getRigNode(root, null),
            tail: getRigNode(root, 'Piglet_TailPivot'),
            walkPhase: 0,
            walkPoseAmount: 0,
            wings: [],
        } satisfies FarmAnimalRig;
    }
    return {
        body: getRigNode(root, 'Sheep_BodyPivot'),
        ears: [
            getRigNode(root, 'Sheep_EarPivot_L'),
            getRigNode(root, 'Sheep_EarPivot_R'),
        ],
        head: getRigNode(root, 'Sheep_HeadPivot'),
        jaw: getRigNode(root, 'Sheep_JawPivot'),
        legs: [
            getRigNode(root, 'Sheep_LegPivot_FL'),
            getRigNode(root, 'Sheep_LegPivot_FR'),
            getRigNode(root, 'Sheep_LegPivot_RL'),
            getRigNode(root, 'Sheep_LegPivot_RR'),
        ],
        neck: getRigNode(root, null),
        tail: getRigNode(root, 'Sheep_TailPivot'),
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

export function getChickenHeadPitch({
    behavior,
    moving,
    now,
    swimming,
}: {
    behavior: FarmAnimalBehavior;
    moving: boolean;
    now: number;
    swimming: boolean;
}) {
    const peck =
        behavior === 'forage' && !moving
            ? Math.max(0, Math.sin(now * 5.8)) ** 2
            : 0;
    const dust = behavior === 'dust-bathe' && !moving ? 1 : 0;
    return -peck * 0.78 - dust * 0.28 + (swimming ? -0.12 : 0);
}

export function getPigletHeadPitch({
    behavior,
    moving,
    now,
    swimming,
}: {
    behavior: FarmAnimalBehavior;
    moving: boolean;
    now: number;
    swimming: boolean;
}) {
    const rooting = behavior === 'root' && !moving ? 1 : 0;
    const wallowing = behavior === 'wallow' && !moving ? 1 : 0;
    return (
        -rooting * (0.32 + Math.max(0, Math.sin(now * 4.6)) * 0.24) -
        wallowing * 0.12 +
        (swimming ? -0.1 : 0)
    );
}

export function getGoatHeadPitch({
    behavior,
    moving,
    now,
    swimming,
}: {
    behavior: FarmAnimalBehavior;
    moving: boolean;
    now: number;
    swimming: boolean;
}) {
    if (moving) {
        return swimming ? -0.08 : -0.03;
    }
    if (behavior === 'browse') {
        return -0.68 + Math.sin(now * 1.4) * 0.06;
    }
    if (behavior === 'chew') {
        return -0.16 + Math.sin(now * 0.9) * 0.04;
    }
    if (
        behavior === 'approach-avatar' ||
        behavior === 'retreat-avatar' ||
        behavior === 'follow-avatar'
    ) {
        return 0.11 + Math.sin(now * 1.8) * 0.035;
    }
    return Math.sin(now * 0.7) * 0.045;
}

export function getGoatPlayHopAmount({
    behavior,
    moving,
    now,
}: {
    behavior: FarmAnimalBehavior;
    moving: boolean;
    now: number;
}) {
    if (behavior !== 'play-hop' || moving) {
        return 0;
    }
    return Math.max(0, Math.sin(now * 3.1)) ** 6;
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
        rotationX: getChickenHeadPitch({
            behavior,
            moving,
            now,
            swimming,
        }),
        rotationZ:
            behavior === 'roam' && !moving ? Math.sin(now * 1.7) * 0.16 : 0,
    });
    poseRigNode(rig.wings[0], delta, {
        rotationY: swimming
            ? 0.3 + Math.sin(now * 8.5) * 0.22
            : dust * (0.38 + Math.sin(now * 10) * 0.3),
    });
    poseRigNode(rig.wings[1], delta, {
        rotationY: swimming
            ? -0.3 - Math.sin(now * 8.5) * 0.22
            : dust * (-0.38 - Math.sin(now * 10) * 0.3),
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
        rotationX: getPigletHeadPitch({
            behavior,
            moving,
            now,
            swimming,
        }),
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

export function getSheepHeadPitch({
    behavior,
    moving,
    now,
}: {
    behavior: FarmAnimalBehavior;
    moving: boolean;
    now: number;
}) {
    if (moving) {
        return 0.02 + Math.sin(now * 2.1) * 0.025;
    }
    if (behavior === 'graze') {
        return -0.82 + Math.sin(now * 1.35) * 0.07;
    }
    return Math.sin(now * 0.72) * 0.055;
}

function updateSheepPose({
    behavior,
    delta,
    moving,
    now,
    rig,
    seed,
    trotting,
    walkDistance,
}: {
    behavior: FarmAnimalBehavior;
    delta: number;
    moving: boolean;
    now: number;
    rig: FarmAnimalRig;
    seed: number;
    trotting: boolean;
    walkDistance: number;
}) {
    const phaseOffset = (seed % 997) / 997;
    const localTime = now + phaseOffset * 6.4;
    rig.walkPoseAmount = MathUtils.damp(
        rig.walkPoseAmount,
        moving ? 1 : 0,
        8,
        delta,
    );
    if (moving) {
        rig.walkPhase =
            (walkDistance / sheepConfig.walkCycleDistance) * fullTurn;
    }
    const gaitAmount = (trotting ? 0.62 : 0.43) * rig.walkPoseAmount;
    const diagonal = Math.sin(rig.walkPhase) * gaitAmount;
    rig.legs.forEach((leg, index) => {
        poseRigNode(leg, delta, {
            rotationX: index === 0 || index === 3 ? diagonal : -diagonal,
        });
    });

    const breathing = Math.sin(localTime * 1.15) * 0.012;
    const gaitLift = moving
        ? Math.max(0, Math.sin(rig.walkPhase * 2)) * (trotting ? 0.045 : 0.022)
        : 0;
    poseRigNode(rig.body, delta, {
        positionY: breathing + gaitLift,
        rotationZ: moving ? Math.sin(rig.walkPhase) * 0.025 : 0,
    });
    poseRigNode(rig.head, delta, {
        rotationX: getSheepHeadPitch({ behavior, moving, now: localTime }),
        rotationY:
            !moving && behavior !== 'graze'
                ? Math.sin(localTime * 0.58) * 0.11
                : 0,
        rotationZ:
            !moving && behavior === 'roam'
                ? Math.sin(localTime * 0.82) * 0.06
                : 0,
    });

    const chewing = behavior === 'chew-cud' && !moving;
    poseRigNode(rig.jaw, delta, {
        rotationX: chewing
            ? 0.08 + Math.max(0, Math.sin(localTime * 3.4)) * 0.13
            : 0,
        rotationY: chewing ? Math.sin(localTime * 1.7) * 0.045 : 0,
    });
    rig.ears.forEach((ear, index) => {
        const side = index === 0 ? 1 : -1;
        poseRigNode(ear, delta, {
            rotationX: Math.sin(localTime * 1.1 + index * 1.8) * 0.055,
            rotationZ:
                side *
                Math.max(0, Math.sin(localTime * 1.65 + index * 2.2)) *
                0.13,
        });
    });
    const tailPulse = Math.max(0, Math.sin(localTime * 1.38) - 0.84) / 0.16;
    poseRigNode(rig.tail, delta, {
        rotationY: tailPulse * Math.sin(localTime * 11) * 0.48,
    });
}

function updateGoatPose({
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
            (walkDistance / goatConfig.walkCycleDistance) * fullTurn;
    }

    const walkAmount = rig.walkPoseAmount;
    const diagonal =
        Math.sin(rig.walkPhase) * (swimming ? 0.56 : 0.48) * walkAmount;
    const hop = getGoatPlayHopAmount({ behavior, moving, now });
    rig.legs.forEach((leg, index) => {
        const isFrontLeg = index <= 1;
        const step = index === 0 || index === 3 ? diagonal : -diagonal;
        poseRigNode(leg, delta, {
            rotationX:
                (swimming ? -0.24 : 0) +
                step +
                hop * (isFrontLeg ? -0.72 : 0.26),
        });
    });

    poseRigNode(rig.body, delta, {
        positionY: swimming
            ? 0.025 + Math.sin(now * 5.2) * 0.012
            : moving
              ? Math.max(0, Math.sin(rig.walkPhase * 2)) * 0.022
              : hop * 0.14,
        rotationX: swimming ? -0.05 : -hop * 0.2,
    });
    poseRigNode(rig.neck, delta, {
        rotationX:
            behavior === 'browse' && !moving ? -0.28 : hop > 0 ? 0.16 : 0,
    });
    poseRigNode(rig.head, delta, {
        rotationX: getGoatHeadPitch({
            behavior,
            moving,
            now,
            swimming,
        }),
        rotationY:
            !moving && behavior === 'roam' ? Math.sin(now * 0.9) * 0.14 : 0,
        rotationZ:
            !moving &&
            (behavior === 'approach-avatar' ||
                behavior === 'retreat-avatar' ||
                behavior === 'follow-avatar')
                ? Math.sin(now * 1.5) * 0.055
                : 0,
    });

    const chewing =
        !moving && (behavior === 'browse' || behavior === 'chew') ? 1 : 0;
    poseRigNode(rig.jaw, delta, {
        rotationX: chewing * (0.08 + Math.max(0, Math.sin(now * 5.4)) * 0.13),
        rotationY: chewing * Math.sin(now * 2.7) * 0.035,
    });
    rig.ears.forEach((ear, index) => {
        const side = index === 0 ? -1 : 1;
        poseRigNode(ear, delta, {
            rotationY: side * Math.sin(now * 1.15 + index) * 0.055,
            rotationZ:
                side * 0.06 + Math.sin(now * 4.6 + index * Math.PI) * 0.12,
        });
    });
    const curious =
        behavior === 'approach-avatar' ||
        behavior === 'retreat-avatar' ||
        behavior === 'follow-avatar';
    poseRigNode(rig.tail, delta, {
        rotationX: moving ? Math.sin(rig.walkPhase * 2) * 0.08 : 0,
        rotationY:
            Math.sin(now * (curious ? 8.2 : 5.4)) * (curious ? 0.32 : 0.16),
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
    if (species === 'Chicken') {
        return ['home', 'roam', 'forage', 'dust-bathe', 'cover'].includes(
            behavior,
        );
    }
    if (species === 'Goat') {
        return ['home', 'roam', 'browse', 'chew', 'play-hop', 'cover'].includes(
            behavior,
        );
    }
    if (species === 'Piglet') {
        return ['home', 'roam', 'root', 'wallow', 'cover'].includes(behavior);
    }
    return ['home', 'roam', 'graze', 'chew-cud'].includes(behavior);
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
    const homePlacementSignatureRef = useRef(
        `${habitat.home.position.x}:${habitat.home.position.y}:${habitat.home.position.z}:${habitat.home.facingYaw ?? 0}`,
    );
    const randomRef = useRef(createRandom(habitat.seed));
    const lastPresenceUpdateRef = useRef(0);
    const lastDebugUpdateRef = useRef(0);
    const lastPetRequestSequenceRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const followAvatarUntilRef = useRef(Number.NEGATIVE_INFINITY);
    const nextFollowRepathAtRef = useRef(Number.NEGATIVE_INFINITY);
    const nextCuriosityAtRef = useRef(0);
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

    function getFreshSheepNeighbors(now: number) {
        if (habitat.species !== 'Sheep') {
            return [];
        }
        return freshAnimalPresences({
            entries: gameStateStore.getState().animalPresenceEntries,
            now,
            species: 'Sheep',
        }).map((entry) => ({
            id: entry.id,
            x: entry.position.x,
            z: entry.position.z,
        }));
    }

    function flockAwareTarget(target: FarmAnimalTarget, now: number) {
        const group = groupRef.current;
        if (
            habitat.species !== 'Sheep' ||
            !group ||
            target.behavior === 'home' ||
            target.behavior === 'follow-avatar'
        ) {
            return target;
        }
        const adjusted = adjustSheepTargetForFlock({
            animalId: habitat.id,
            from: group.position,
            neighbors: getFreshSheepNeighbors(now),
            target: target.position,
        });
        const position = target.position.clone();
        position.x = adjusted.x;
        position.z = adjusted.z;
        position.y = getAnimalMovementYAt(position, habitat.groundSurfaces);
        const cellIsBlocked = habitat.blockedCells.some(
            (cell) =>
                cell.x === Math.round(position.x) &&
                cell.z === Math.round(position.z),
        );
        if (
            cellIsBlocked ||
            !canAnimalSettleAt(position, habitat.groundSurfaces)
        ) {
            return target;
        }
        return { ...target, position } satisfies FarmAnimalTarget;
    }

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

    const homePlacementSignature = `${habitat.home.position.x}:${habitat.home.position.y}:${habitat.home.position.z}:${habitat.home.facingYaw ?? 0}`;
    useEffect(() => {
        const placementChanged =
            homePlacementSignatureRef.current !== homePlacementSignature;
        homePlacementSignatureRef.current = homePlacementSignature;
        if (habitat.species === 'Sheep' && placementChanged) {
            runtimeRef.current = null;
        }
        initializeAnimalAtHome({
            actor: groupRef.current,
            home: habitat.home,
            runtimeInitialized: runtimeRef.current !== null,
        });
    }, [habitat.home, habitat.species, homePlacementSignature]);

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
        if (habitat.species !== 'Goat' && habitat.species !== 'Sheep') {
            event.stopPropagation();
        }
    }

    function handlePointerOver(event: ThreeEvent<PointerEvent>) {
        if (habitat.species !== 'Sheep') {
            event.stopPropagation();
        }
        showSpeechMessage();
    }

    function handleClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        const group = groupRef.current;
        if (!group) {
            return;
        }
        const now = clock.getElapsedTime();
        const target = flockAwareTarget(
            chooseNextFarmAnimalTarget({
                habitat,
                random: randomRef.current,
                timeOfDay,
                weather,
            }),
            now,
        );
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
                habitat.species === 'Goat'
                    ? goatCuriosityPosition({
                          avatarPosition: gardenAvatarPresence.position,
                          distance: animalAvatarFollowDistance,
                          goatPosition: group.position,
                          habitat,
                      })
                    : getAnimalAvatarFollowPosition(gardenAvatarPresence);
            if (!position) {
                nextFollowRepathAtRef.current =
                    now + animalAvatarFollowRepathSeconds;
                return;
            }
            position.y = getAnimalMovementYAt(position, habitat.groundSurfaces);
            const avatarTargetCellIsBlocked = habitat.blockedCells.some(
                (cell) =>
                    cell.x === Math.round(position.x) &&
                    cell.z === Math.round(position.z),
            );
            if (
                habitat.species === 'Sheep' &&
                (avatarTargetCellIsBlocked ||
                    !canAnimalSettleAt(position, habitat.groundSurfaces))
            ) {
                position.copy(group.position);
            }
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

        const freshAvatar = isFreshGardenAvatarPresence(
            gardenAvatarPresence,
            now,
        );
        const avatarDistance = freshAvatar
            ? horizontalDistance(group.position, gardenAvatarPresence.position)
            : Number.POSITIVE_INFINITY;
        const curiosityReady = canGoatStartCuriosity({
            avatarDistance,
            canFollowAvatar,
            freshAvatar,
            nextCuriosityAt: nextCuriosityAtRef.current,
            now,
            phase: runtime.phase,
            species: habitat.species,
            targetBehavior: runtime.target.behavior,
            timeOfDay,
            weather,
        });
        if (curiosityReady && gardenAvatarPresence) {
            const curiosityTarget = getGoatCuriosityTarget({
                avatarPosition: gardenAvatarPresence.position,
                goatPosition: group.position,
                habitat,
            });
            if (curiosityTarget) {
                runtime = resolveFarmAnimalRuntimeForTarget({
                    from: group.position,
                    habitat,
                    now,
                    random,
                    target: curiosityTarget,
                    timeOfDay,
                    weather,
                });
                runtimeRef.current = runtime;
                nextCuriosityAtRef.current =
                    now +
                    (curiosityTarget.behavior === 'retreat-avatar'
                        ? 3
                        : 7 + random() * 5);
            }
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
                const target = flockAwareTarget(
                    chooseNextFarmAnimalTarget({
                        forcedBehavior: animalDebugCommand.behavior,
                        habitat,
                        random,
                        timeOfDay,
                        weather,
                    }),
                    now,
                );
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
            const calmAvatarReaction =
                habitat.species === 'Sheep' &&
                isFreshGardenAvatarPresence(gardenAvatarPresence, now) &&
                horizontalDistance(
                    group.position,
                    gardenAvatarPresence.position,
                ) < 2.2;
            if (calmAvatarReaction) {
                facePosition(
                    group,
                    new Vector3(
                        gardenAvatarPresence.position.x,
                        group.position.y,
                        gardenAvatarPresence.position.z,
                    ),
                    delta * 0.45,
                );
            } else if (runtime.target.lookAtPosition) {
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
                const target = flockAwareTarget(
                    chooseNextFarmAnimalTarget({
                        forcedBehavior: mustReturnHome ? 'home' : undefined,
                        habitat,
                        random,
                        timeOfDay,
                        weather,
                    }),
                    now,
                );
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

        if (habitat.species === 'Sheep') {
            const separation = scaleSheepSeparationOffset({
                delta,
                offset: getSheepSeparationOffset({
                    animalId: habitat.id,
                    from: group.position,
                    neighbors: getFreshSheepNeighbors(now),
                }),
            });
            if (separation.x !== 0 || separation.z !== 0) {
                const separated = group.position.clone();
                separated.x += separation.x;
                separated.z += separation.z;
                separated.y = getAnimalMovementYAt(
                    separated,
                    habitat.groundSurfaces,
                );
                const cellIsBlocked = habitat.blockedCells.some(
                    (cell) =>
                        cell.x === Math.round(separated.x) &&
                        cell.z === Math.round(separated.z),
                );
                if (
                    !cellIsBlocked &&
                    canAnimalSettleAt(separated, habitat.groundSurfaces)
                ) {
                    group.position.copy(separated);
                }
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
        } else if (habitat.species === 'Goat') {
            updateGoatPose({
                behavior: activeRuntime.target.behavior,
                delta,
                moving: activeRuntime.phase === 'moving',
                now,
                rig: model.rig,
                swimming: locomotion === 'swimming',
                walkDistance,
            });
        } else if (habitat.species === 'Piglet') {
            updatePigletPose({
                behavior: activeRuntime.target.behavior,
                delta,
                moving: activeRuntime.phase === 'moving',
                now,
                rig: model.rig,
                swimming: locomotion === 'swimming',
                walkDistance,
            });
        } else {
            updateSheepPose({
                behavior: activeRuntime.target.behavior,
                delta,
                moving: activeRuntime.phase === 'moving',
                now,
                rig: model.rig,
                seed: habitat.seed,
                trotting:
                    activeRuntime.phase === 'moving' &&
                    activeRuntime.sheepLocomotion === 'trot',
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
                    : habitat.species === 'Goat'
                      ? ['home', 'roam', 'browse', 'chew', 'play-hop', 'cover']
                      : habitat.species === 'Piglet'
                        ? ['home', 'roam', 'root', 'wallow', 'cover']
                        : ['home', 'roam', 'graze', 'chew-cud'];
            const entry = {
                activity:
                    runtime.phase === 'moving'
                        ? `${runtime.sheepLocomotion ?? locomotion} to ${runtime.target.behavior}`
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

    const actor = (
        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js actor is interactive
        <group
            ref={groupRef}
            onClick={habitat.species === 'Sheep' ? undefined : handleClick}
            onPointerDown={handlePointerDown}
            onPointerOver={handlePointerOver}
            scale={config.scale}
        >
            <primitive object={model.scene} />
        </group>
    );
    const controllableActor =
        habitat.species === 'Sheep' ? (
            <PickableGroup block={habitat.homeBlock} stack={habitat.homeStack}>
                <RotatableGroup block={habitat.homeBlock}>
                    {actor}
                </RotatableGroup>
            </PickableGroup>
        ) : (
            actor
        );

    return (
        <>
            {controllableActor}
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
            createFarmAnimalHabitats({
                blockData,
                config,
                stacks,
            }),
        [blockData, config, stacks],
    );
    useSceneTimeInvalidation(
        `fauna:farm-animals:${config.species.toLowerCase()}`,
        habitats.length > 0,
        sceneFrameRates.ambient,
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

export function Sheep({
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
            config={sheepConfig}
            farmId={farmId}
            stacks={stacks}
            weather={weather}
            weatherDisabled={weatherDisabled}
        />
    );
}

export function LegacySheep({
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
            config={legacySheepConfig}
            farmId={farmId}
            stacks={stacks}
            weather={weather}
            weatherDisabled={weatherDisabled}
        />
    );
}

export function Goats({
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
            config={goatConfig}
            farmId={farmId}
            stacks={stacks}
            weather={weather}
            weatherDisabled={weatherDisabled}
        />
    );
}

export function Goat({
    block,
    farmId,
    stack,
    stacks,
    weather,
    weatherDisabled = false,
}: EntityInstanceProps) {
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
    const habitatStacks = useMemo(() => {
        const availableStacks = stacks ?? [];
        const containsGoat = availableStacks.some((candidateStack) =>
            candidateStack.blocks.some(
                (candidateBlock) => candidateBlock.id === block.id,
            ),
        );
        return containsGoat ? availableStacks : [...availableStacks, stack];
    }, [block.id, stack, stacks]);
    const habitat = useMemo(
        () =>
            createFarmAnimalHabitats({
                blockData,
                config: legacyGoatConfig,
                stacks: habitatStacks,
            }).find((candidate) => candidate.home.id === `home-${block.id}`) ??
            null,
        [block.id, blockData, habitatStacks],
    );
    useSceneTimeInvalidation(
        'fauna:farm-animals:goat',
        habitat !== null,
        sceneFrameRates.ambient,
    );
    if (!habitat) {
        return null;
    }

    return (
        <FarmAnimal
            config={legacyGoatConfig}
            habitat={habitat}
            weather={resolvedWeather}
        />
    );
}
