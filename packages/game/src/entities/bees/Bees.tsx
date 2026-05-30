import type { BlockData } from '@gredice/client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group, Material, Object3D } from 'three';
import {
    DoubleSide,
    MathUtils,
    Mesh,
    MeshStandardMaterial,
    Vector3,
} from 'three';
import { useGameFlags } from '../../GameFlagsContext';
import { useBlockData } from '../../hooks/useBlockData';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
    type AnimalDisturbance,
    type GameState,
    useGameState,
} from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import {
    getGridPositionFromIndex,
    type RaisedBedOrientation,
} from '../../utils/raisedBedOrientation';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { getCactusVariantConfig } from '../Cactus';
import { getBlockSurfaceDecorations } from '../groundDecorations/getBlockSurfaceDecorations';
import { resolveGroundDecorationSurface } from '../groundDecorations/groundDecorationConfig';
import { tulipBouquetStems } from '../tulipBouquet';
import {
    type BeeWeather,
    createBeeWanderOffset,
    getBeeDwellSeconds,
    getBeeSpawnHabitatGroups,
    getBeeWanderHoverSeconds,
    isBeeActive,
    shouldBeeWanderNext,
} from './beeBehavior';

type BeeRaisedBedField = {
    active?: boolean | null;
    plantSortId?: number | null;
    plantStatus?: string | null;
    positionIndex: number;
};

type BeeWeatherOverride = Partial<NonNullable<GameState['weather']>>;

type BeeGarden = {
    id?: number | string;
    raisedBeds: {
        blockId: string | null;
        fields?: BeeRaisedBedField[] | null;
        id: number;
        orientation?: RaisedBedOrientation;
    }[];
    stacks: Stack[];
};

type BeeTarget = {
    id: string;
    blockIds?: string[];
    kind:
        | 'flower'
        | 'raised-bed-flower'
        | 'cactus-flower'
        | 'ground-flower'
        | 'wander';
    position: Vector3;
};

type BeeHabitat = {
    id: string;
    seed: number;
    center: Vector3;
    startTarget: BeeTarget;
    targets: BeeTarget[];
};

type FlightSpeedProfile = {
    flutter: number;
    phase: number;
    total: number;
};

type MovingBeeState = {
    phase: 'moving';
    duration: number;
    entryTangent: Vector3;
    exitTangent: Vector3;
    flightPhase: number;
    from: Vector3;
    speedProfile: FlightSpeedProfile;
    startedAt: number;
    target: BeeTarget;
    to: Vector3;
};

type ForagingBeeState = {
    phase: 'foraging';
    dwellUntil: number;
    landingPosition: Vector3;
    landingYaw: number;
    startedAt: number;
    target: BeeTarget;
};

type BeeRuntimeState = MovingBeeState | ForagingBeeState;

type BeeRigNode = {
    basePositionY: number;
    baseRotationX: number;
    baseRotationY: number;
    baseRotationZ: number;
    object: Object3D | null;
};

type BeeRigParts = {
    bodyPivot: BeeRigNode;
    headPivot: BeeRigNode;
    wingLeft: BeeRigNode;
    wingRight: BeeRigNode;
};

const clearBeeWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
} satisfies BeeWeather;

const beeScale = 0.095;
const beeFlightSpeedBlocksPerSecond = 1.1;
const beeFlightTurnDamping = 7.5;
const beeFlightLookAheadProgress = 0.06;
const beeFlightArcMaxHeight = 0.42;
const beeFlowerRestHeight = 0.025;
const cactusFlowerHoverHeight = 0.08;
const defaultTurnDamping = 9;
const groundDecorationBlockYOffset = 0.2;
const groundFlowerHoverHeight = 0.08;
const raisedBedFlowerHoverHeight = 0.42;
const tulipFlowerHoverHeight = 0.52;
const animalDisturbanceReactionWindowMs = 2500;
const fullTurn = Math.PI * 2;
const yAxis = new Vector3(0, 1, 0);

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

function isBeeTargetDisturbed(
    target: BeeTarget,
    disturbance: AnimalDisturbance,
) {
    return (
        (target.blockIds?.includes(disturbance.sourceBlockId) ?? false) ||
        distanceToDisturbance(target.position, disturbance) <=
            disturbance.radius
    );
}

function isBeeDisturbanceRelevant({
    disturbance,
    group,
    runtime,
}: {
    disturbance: AnimalDisturbance;
    group: Group;
    runtime: BeeRuntimeState;
}) {
    return (
        isBeeTargetDisturbed(runtime.target, disturbance) ||
        distanceToDisturbance(group.position, disturbance) <= disturbance.radius
    );
}

function pickCandidate<T>(candidates: T[], random: () => number) {
    if (candidates.length <= 0) {
        return null;
    }

    return candidates[Math.floor(random() * candidates.length)] ?? null;
}

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

function rotateLocalPosition(localPosition: Vector3, rotation: number) {
    return localPosition
        .clone()
        .applyAxisAngle(yAxis, rotation * (Math.PI / 2));
}

function createTulipTargets(
    stacks: Stack[],
    blockData: BlockData[] | null | undefined,
) {
    const targets: BeeTarget[] = [];

    for (const stack of stacks) {
        for (const block of stack.blocks) {
            if (block.name !== 'Tulip') {
                continue;
            }

            const baseHeight = getStackHeight(blockData, stack, block);
            for (const stem of tulipBouquetStems) {
                const offset = rotateLocalPosition(
                    new Vector3(stem.position[0], 0, stem.position[2]),
                    block.rotation,
                );
                targets.push({
                    id: `tulip-${block.id}-${stem.key}`,
                    blockIds: [block.id],
                    kind: 'flower',
                    position: new Vector3(
                        stack.position.x + offset.x,
                        baseHeight + tulipFlowerHoverHeight + stem.position[1],
                        stack.position.z + offset.z,
                    ),
                });
            }
        }
    }

    return targets;
}

function isBeeFloweringField(field: BeeRaisedBedField) {
    return (
        isRaisedBedFieldOccupied(field) &&
        (field.plantStatus === 'firstFlowers' ||
            field.plantStatus === 'firstFruitSet' ||
            field.plantStatus === 'ready')
    );
}

function createRaisedBedTargets(
    garden: BeeGarden,
    blockData: BlockData[] | null | undefined,
) {
    const targets: BeeTarget[] = [];

    for (const raisedBed of garden.raisedBeds) {
        const fields = raisedBed.fields?.filter(isBeeFloweringField) ?? [];
        if (fields.length <= 0) {
            continue;
        }

        const blockIds = getRaisedBedBlockIds(garden, raisedBed.id);
        const orientation = raisedBed.orientation ?? 'vertical';

        for (const blockId of blockIds) {
            const placement = findBlockPlacement(garden.stacks, blockId);
            if (!placement) {
                continue;
            }

            const blockIndex = blockIds.indexOf(blockId);
            const blockOffset =
                Math.max(blockIds.length - 1 - blockIndex, 0) * 9;
            const currentStackHeight = getStackHeight(
                blockData,
                placement.stack,
                placement.block,
            );
            const offsetX =
                orientation === 'vertical' ? 0.31 - blockIndex * 0.05 : 0.27;
            const offsetY =
                orientation === 'vertical' ? 0.27 : 0.27 + blockIndex * 0.05;
            const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
            const multiplierY = orientation === 'vertical' ? 0.27 : 0.285;

            for (const field of fields) {
                const localPositionIndex = field.positionIndex - blockOffset;
                if (localPositionIndex < 0 || localPositionIndex >= 9) {
                    continue;
                }

                const { row, col } = getGridPositionFromIndex(
                    localPositionIndex,
                    orientation,
                );
                targets.push({
                    id: `raised-bed-${raisedBed.id}-${field.positionIndex}`,
                    blockIds: [blockId],
                    kind: 'raised-bed-flower',
                    position: new Vector3(
                        placement.stack.position.x +
                            col * multiplierX -
                            offsetX,
                        currentStackHeight +
                            1 -
                            0.75 +
                            raisedBedFlowerHoverHeight,
                        placement.stack.position.z +
                            (2 - row) * multiplierY -
                            offsetY,
                    ),
                });
            }
        }
    }

    return targets;
}

function createCactusTargets(
    stacks: Stack[],
    blockData: BlockData[] | null | undefined,
) {
    const targets: BeeTarget[] = [];

    for (const stack of stacks) {
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
                    id: `cactus-${block.id}-${flower.id}`,
                    blockIds: [block.id],
                    kind: 'cactus-flower',
                    position: new Vector3(
                        stack.position.x + offset.x,
                        baseHeight -
                            config.groundSink +
                            flower.position[1] * config.scale +
                            cactusFlowerHoverHeight,
                        stack.position.z + offset.z,
                    ),
                });
            }
        }
    }

    return targets;
}

function createGroundFlowerTargets({
    blockData,
    density,
    garden,
}: {
    blockData: BlockData[] | null | undefined;
    density: number;
    garden: BeeGarden;
}) {
    if (density <= 0) {
        return [];
    }

    const targets: BeeTarget[] = [];
    const gardenId = garden.id ?? null;

    for (const stack of garden.stacks) {
        for (const block of stack.blocks) {
            const surface = resolveGroundDecorationSurface(block.name);
            if (!surface) {
                continue;
            }

            const placements = getBlockSurfaceDecorations({
                block,
                density,
                gardenId,
                surface,
            });
            const blockBaseY =
                getStackHeight(blockData, stack, block) +
                groundDecorationBlockYOffset;

            placements.forEach((placement, index) => {
                if (placement.kind !== 'flower') {
                    return;
                }

                const offset = rotateLocalPosition(
                    new Vector3(
                        placement.position[0],
                        0,
                        placement.position[2],
                    ),
                    block.rotation,
                );
                targets.push({
                    id: `ground-flower-${block.id}-${index}`,
                    blockIds: [block.id],
                    kind: 'ground-flower',
                    position: new Vector3(
                        stack.position.x + offset.x,
                        blockBaseY +
                            placement.position[1] +
                            Math.max(
                                groundFlowerHoverHeight,
                                placement.scale * 0.24,
                            ),
                        stack.position.z + offset.z,
                    ),
                });
            });
        }
    }

    return targets;
}

function createFlowerEntityTargets(
    garden: BeeGarden,
    blockData: BlockData[] | null | undefined,
) {
    return createTulipTargets(garden.stacks, blockData);
}

function createFlowerInteractionTargets({
    blockData,
    garden,
    groundDecorationDensity,
}: {
    blockData: BlockData[] | null | undefined;
    garden: BeeGarden;
    groundDecorationDensity: number;
}) {
    return [
        ...createRaisedBedTargets(garden, blockData),
        ...createCactusTargets(garden.stacks, blockData),
        ...createGroundFlowerTargets({
            blockData,
            density: groundDecorationDensity,
            garden,
        }),
    ];
}

function computeHabitatCenter(targets: BeeTarget[]) {
    if (targets.length <= 0) {
        return new Vector3();
    }

    const sum = new Vector3();
    for (const target of targets) {
        sum.add(target.position);
    }
    return sum.divideScalar(targets.length);
}

function createBeeHabitats(
    garden: BeeGarden | null | undefined,
    blockData: BlockData[] | null | undefined,
    groundDecorationDensity: number,
) {
    if (!garden) {
        return [];
    }

    const spawnTargets = createFlowerEntityTargets(garden, blockData);
    if (spawnTargets.length <= 0) {
        return [];
    }

    const targetGroups = getBeeSpawnHabitatGroups({
        spawnTargets,
        additionalTargets: createFlowerInteractionTargets({
            blockData,
            garden,
            groundDecorationDensity,
        }),
    });
    if (targetGroups.length <= 0) {
        return [];
    }

    return targetGroups.flatMap((targets, index) => {
        const firstTarget = targets[0];
        if (!firstTarget) {
            return [];
        }

        const seed = hashString(
            `${garden.id ?? 'garden'}-bee-${index}-${firstTarget.id}-${targets.length}`,
        );
        const random = createRandom(seed);
        return [
            {
                id: `bee-${index + 1}`,
                seed,
                center: computeHabitatCenter(targets),
                startTarget:
                    targets[Math.floor(random() * targets.length)] ??
                    firstTarget,
                targets,
            } satisfies BeeHabitat,
        ];
    });
}

function movementDuration(from: Vector3, to: Vector3) {
    return MathUtils.clamp(
        from.distanceTo(to) / beeFlightSpeedBlocksPerSecond,
        0.85,
        5.2,
    );
}

function createFlightTangent(from: Vector3, to: Vector3) {
    const offset = to.clone().sub(from);
    const distance = offset.length();
    if (distance <= 0.001) {
        return new Vector3(0, 0, 0.4);
    }

    return offset.normalize().multiplyScalar(distance * 0.6);
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

function flightSpeedWeight(profile: FlightSpeedProfile, progress: number) {
    const cruiseLift = 0.82 + Math.sin(progress * Math.PI) * 0.32;
    const wingPulse =
        1 +
        Math.sin(progress * fullTurn * 3 + profile.phase) * profile.flutter +
        Math.sin(progress * fullTurn * 6.2 + profile.phase * 0.5) *
            profile.flutter *
            0.5;
    return Math.max(0.46, cruiseLift * wingPulse);
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
        flutter: 0.08 + random() * 0.055,
        phase: random() * fullTurn,
        total: 1,
    };
    profile.total = integrateFlightSpeedProfile(profile, 1);
    return profile;
}

function flightProgressAt(runtime: MovingBeeState, progress: number) {
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

function flightPositionAt(runtime: MovingBeeState, progress: number) {
    const distance = horizontalDistance(runtime.from, runtime.to);
    const position = hermitePosition({
        entryTangent: runtime.entryTangent,
        exitTangent: runtime.exitTangent,
        from: runtime.from,
        progress,
        to: runtime.to,
    });
    position.y +=
        Math.sin(progress * Math.PI) *
        MathUtils.clamp(distance * 0.16, 0.08, beeFlightArcMaxHeight);

    const sideVector = new Vector3(
        -(runtime.to.z - runtime.from.z),
        0,
        runtime.to.x - runtime.from.x,
    );
    if (sideVector.lengthSq() > 0.000001) {
        sideVector
            .normalize()
            .multiplyScalar(
                Math.sin(progress * fullTurn * 2 + runtime.flightPhase) *
                    Math.sin(progress * Math.PI) *
                    0.045,
            );
        position.add(sideVector);
    }

    return position;
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

function createWanderTarget(
    habitatCenter: Vector3,
    random: () => number,
): BeeTarget {
    const offset = createBeeWanderOffset(random);
    const sequenceId = Math.floor(random() * 0xffffffff)
        .toString(16)
        .padStart(8, '0');
    return {
        id: `wander-${sequenceId}`,
        kind: 'wander',
        position: new Vector3(
            habitatCenter.x + offset.dx,
            habitatCenter.y + offset.dy,
            habitatCenter.z + offset.dz,
        ),
    };
}

function createBeeFleeTarget({
    disturbance,
    from,
    habitatCenter,
    random,
}: {
    disturbance: AnimalDisturbance;
    from: Vector3;
    habitatCenter: Vector3;
    random: () => number;
}): BeeTarget {
    const away = new Vector3(
        from.x - disturbance.position.x,
        0,
        from.z - disturbance.position.z,
    );

    if (away.lengthSq() <= 0.0001) {
        const angle = random() * fullTurn;
        away.set(Math.cos(angle), 0, Math.sin(angle));
    } else {
        away.normalize();
    }

    const distance = 1.15 + random() * 0.7;
    const side = new Vector3(-away.z, 0, away.x).multiplyScalar(
        (random() - 0.5) * 0.55,
    );

    const sequenceId = Math.floor(random() * 0xffffffff)
        .toString(16)
        .padStart(8, '0');

    return {
        id: `flee-${disturbance.sequence}-${sequenceId}`,
        kind: 'wander',
        position: new Vector3(
            from.x + away.x * distance + side.x,
            Math.max(
                from.y + 0.35 + random() * 0.3,
                habitatCenter.y + 0.45,
                disturbance.position.y + 0.85,
            ),
            from.z + away.z * distance + side.z,
        ),
    };
}

function chooseNextTarget({
    currentTarget,
    habitatCenter,
    random,
    targets,
}: {
    currentTarget: BeeTarget;
    habitatCenter: Vector3;
    random: () => number;
    targets: BeeTarget[];
}) {
    const otherTargets = targets.filter(
        (target) => target.id !== currentTarget.id,
    );

    if (
        shouldBeeWanderNext({
            otherFlowerCount: otherTargets.length,
            currentlyWandering: currentTarget.kind === 'wander',
            random,
        })
    ) {
        return createWanderTarget(habitatCenter, random);
    }

    const nearbyTargets = otherTargets.filter(
        (target) =>
            horizontalDistance(target.position, currentTarget.position) <= 6,
    );

    return (
        pickCandidate(
            nearbyTargets.length > 0 ? nearbyTargets : otherTargets,
            random,
        ) ?? currentTarget
    );
}

function makeMovingState({
    from,
    now,
    random,
    target,
}: {
    from: Vector3;
    now: number;
    random: () => number;
    target: BeeTarget;
}) {
    const to = createBeeLandingPosition(target, random);
    const directFlightTangent = createFlightTangent(from, to);
    return {
        phase: 'moving',
        duration: movementDuration(from, to),
        entryTangent: directFlightTangent,
        exitTangent: directFlightTangent,
        flightPhase: random() * fullTurn,
        from,
        speedProfile: createFlightSpeedProfile(random),
        startedAt: now,
        target,
        to,
    } satisfies MovingBeeState;
}

function yawTowardPosition(from: Vector3, to: Vector3) {
    const directionX = to.x - from.x;
    const directionZ = to.z - from.z;
    if (Math.hypot(directionX, directionZ) <= 0.001) {
        return 0;
    }

    return Math.atan2(directionX, directionZ);
}

function createBeeLandingPosition(target: BeeTarget, random: () => number) {
    if (target.kind === 'wander') {
        return target.position.clone();
    }

    const targetJitterRadius =
        target.kind === 'raised-bed-flower'
            ? 0.012 + random() * 0.018
            : 0.02 + random() * 0.028;
    const targetJitterAngle = random() * fullTurn;
    return target.position
        .clone()
        .add(
            new Vector3(
                Math.cos(targetJitterAngle) * targetJitterRadius,
                beeFlowerRestHeight,
                Math.sin(targetJitterAngle) * targetJitterRadius,
            ),
        );
}

function makeForagingState({
    flightYaw,
    landingPosition,
    now,
    random,
    target,
}: {
    flightYaw?: number;
    landingPosition?: Vector3;
    now: number;
    random: () => number;
    target: BeeTarget;
}) {
    const position =
        landingPosition ?? createBeeLandingPosition(target, random);
    const isWander = target.kind === 'wander';
    return {
        phase: 'foraging',
        dwellUntil:
            now +
            (isWander
                ? getBeeWanderHoverSeconds(random)
                : getBeeDwellSeconds(random)),
        landingPosition: position,
        landingYaw: isWander
            ? (flightYaw ?? 0)
            : yawTowardPosition(position, target.position),
        startedAt: now,
        target,
    } satisfies ForagingBeeState;
}

function foragePositionAt(runtime: ForagingBeeState) {
    return runtime.landingPosition.clone();
}

function cloneBeeMaterial(material: Material, objectName: string) {
    const clone = material.clone();
    if (clone instanceof MeshStandardMaterial) {
        clone.metalness = 0;
        if (objectName.includes('Bee_Wing')) {
            clone.depthWrite = false;
            clone.opacity = 0.52;
            clone.roughness = 0.34;
            clone.side = DoubleSide;
            clone.transparent = true;
        } else if (clone.name === 'Material.Bee.Yellow') {
            clone.color.set('#f4c400');
            clone.roughness = 0.7;
        } else if (clone.name === 'Material.Bee.Gold') {
            clone.color.set('#d68a00');
            clone.roughness = 0.74;
        } else {
            clone.roughness = 0.72;
        }
    }

    return clone;
}

function isMesh(object: Object3D): object is Mesh {
    return object instanceof Mesh;
}

function prepareBeeMesh(object: Mesh) {
    const isWing = object.name.includes('Bee_Wing');
    object.castShadow = !isWing;
    object.receiveShadow = !isWing;
    object.material = Array.isArray(object.material)
        ? object.material.map((material) =>
              cloneBeeMaterial(material, object.name),
          )
        : cloneBeeMaterial(object.material, object.name);
}

function getBeeRigNode(scene: Object3D, name: string): BeeRigNode {
    const object = scene.getObjectByName(name) ?? null;
    return {
        basePositionY: object?.position.y ?? 0,
        baseRotationX: object?.rotation.x ?? 0,
        baseRotationY: object?.rotation.y ?? 0,
        baseRotationZ: object?.rotation.z ?? 0,
        object,
    };
}

function updateBeeRig({
    delta,
    now,
    rig,
    runtime,
    seed,
}: {
    delta: number;
    now: number;
    rig: BeeRigParts;
    runtime: BeeRuntimeState | null;
    seed: number;
}) {
    const flying =
        runtime?.phase === 'moving' ||
        (runtime?.phase === 'foraging' && runtime.target.kind === 'wander');

    if (!flying) {
        if (rig.wingLeft.object) {
            rig.wingLeft.object.rotation.x = rig.wingLeft.baseRotationX;
            rig.wingLeft.object.rotation.y = rig.wingLeft.baseRotationY;
            rig.wingLeft.object.rotation.z = rig.wingLeft.baseRotationZ;
        }
        if (rig.wingRight.object) {
            rig.wingRight.object.rotation.x = rig.wingRight.baseRotationX;
            rig.wingRight.object.rotation.y = rig.wingRight.baseRotationY;
            rig.wingRight.object.rotation.z = rig.wingRight.baseRotationZ;
        }
        if (rig.bodyPivot.object) {
            rig.bodyPivot.object.position.y = rig.bodyPivot.basePositionY;
            rig.bodyPivot.object.rotation.x = rig.bodyPivot.baseRotationX;
            rig.bodyPivot.object.rotation.y = rig.bodyPivot.baseRotationY;
            rig.bodyPivot.object.rotation.z = rig.bodyPivot.baseRotationZ;
        }
        if (rig.headPivot.object) {
            rig.headPivot.object.rotation.x = rig.headPivot.baseRotationX;
            rig.headPivot.object.rotation.y = rig.headPivot.baseRotationY;
            rig.headPivot.object.rotation.z = rig.headPivot.baseRotationZ;
        }
        return;
    }

    const wingSpeed = 72;
    const wingPulse = Math.abs(Math.sin(now * wingSpeed + seed));
    const wingLift = 0.24 + wingPulse * 1.05;

    if (rig.wingLeft.object) {
        rig.wingLeft.object.rotation.x =
            rig.wingLeft.baseRotationX + Math.sin(now * 18 + seed) * 0.08;
        rig.wingLeft.object.rotation.z = rig.wingLeft.baseRotationZ - wingLift;
    }
    if (rig.wingRight.object) {
        rig.wingRight.object.rotation.x =
            rig.wingRight.baseRotationX + Math.sin(now * 18 + seed) * 0.08;
        rig.wingRight.object.rotation.z =
            rig.wingRight.baseRotationZ + wingLift;
    }

    if (rig.bodyPivot.object) {
        rig.bodyPivot.object.position.y = MathUtils.damp(
            rig.bodyPivot.object.position.y,
            rig.bodyPivot.basePositionY + Math.sin(now * 8 + seed) * 0.012,
            18,
            delta,
        );
        rig.bodyPivot.object.rotation.x =
            rig.bodyPivot.baseRotationX + Math.sin(now * 7.2 + seed) * 0.075;
        rig.bodyPivot.object.rotation.z =
            rig.bodyPivot.baseRotationZ + Math.sin(now * 5.4 + seed) * 0.09;
    }

    if (rig.headPivot.object) {
        rig.headPivot.object.rotation.x = rig.headPivot.baseRotationX;
    }
}

function roundBeeDebugCoordinate(value: number) {
    return Math.round(value * 100) / 100;
}

function getBeeDebugActivity(runtime: BeeRuntimeState) {
    if (runtime.phase === 'moving') {
        return `flying to ${runtime.target.kind}`;
    }

    if (runtime.target.kind === 'wander') {
        return 'hovering mid-air';
    }

    return 'visiting flower';
}

function createBeeDebugEntry({
    group,
    habitat,
    now,
    runtime,
}: {
    group: Group;
    habitat: BeeHabitat;
    now: number;
    runtime: BeeRuntimeState;
}): AnimalDebugEntry {
    return {
        id: habitat.id,
        species: 'Bee',
        label: habitat.id,
        phase: runtime.phase,
        behavior: runtime.target.kind,
        activity: getBeeDebugActivity(runtime),
        targetId: runtime.target.id,
        position: {
            x: roundBeeDebugCoordinate(group.position.x),
            y: roundBeeDebugCoordinate(group.position.y),
            z: roundBeeDebugCoordinate(group.position.z),
        },
        updatedAt: now,
    };
}

function Bee({ habitat }: { habitat: BeeHabitat }) {
    const gltf = useGameGLTF('Bee');
    const { enableDebugHudFlag = false } = useGameFlags();
    const groupRef = useRef<Group>(null);
    const randomRef = useRef(createRandom(habitat.seed));
    const runtimeRef = useRef<BeeRuntimeState | null>(null);
    const lastAnimalDebugUpdateRef = useRef(0);
    const lastDisturbanceSequenceRef = useRef(0);
    const setAnimalDebugEntry = useGameState(
        (state) => state.setAnimalDebugEntry,
    );
    const removeAnimalDebugEntry = useGameState(
        (state) => state.removeAnimalDebugEntry,
    );
    const animalDisturbance = useGameState((state) => state.animalDisturbance);

    const beeModel = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse((object) => {
            if (isMesh(object)) {
                prepareBeeMesh(object);
            }
        });
        return {
            rig: {
                bodyPivot: getBeeRigNode(clone, 'Bee_BodyPivot'),
                headPivot: getBeeRigNode(clone, 'Bee_HeadPivot'),
                wingLeft: getBeeRigNode(clone, 'Bee_WingPivot_L'),
                wingRight: getBeeRigNode(clone, 'Bee_WingPivot_R'),
            } satisfies BeeRigParts,
            scene: clone,
        };
    }, [gltf.scene]);

    useEffect(() => {
        randomRef.current = createRandom(habitat.seed);
        runtimeRef.current = null;
        if (groupRef.current) {
            groupRef.current.position.copy(habitat.startTarget.position);
        }
    }, [habitat.seed, habitat.startTarget.position]);

    useEffect(() => {
        if (!enableDebugHudFlag) {
            removeAnimalDebugEntry(habitat.id);
        }

        return () => removeAnimalDebugEntry(habitat.id);
    }, [enableDebugHudFlag, habitat.id, removeAnimalDebugEntry]);

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }

        const now = clock.elapsedTime;
        const random = randomRef.current;
        let runtime = runtimeRef.current;

        if (!runtime) {
            runtime = makeForagingState({
                now,
                random,
                target: habitat.startTarget,
            });
            runtimeRef.current = runtime;
            group.position.copy(foragePositionAt(runtime));
        }

        if (
            animalDisturbance &&
            animalDisturbance.sequence !== lastDisturbanceSequenceRef.current
        ) {
            lastDisturbanceSequenceRef.current = animalDisturbance.sequence;

            if (
                Date.now() - animalDisturbance.createdAt <=
                    animalDisturbanceReactionWindowMs &&
                isBeeDisturbanceRelevant({
                    disturbance: animalDisturbance,
                    group,
                    runtime,
                })
            ) {
                runtime = makeMovingState({
                    from: group.position.clone(),
                    now,
                    random,
                    target: createBeeFleeTarget({
                        disturbance: animalDisturbance,
                        from: group.position,
                        habitatCenter: habitat.center,
                        random,
                    }),
                });
                runtimeRef.current = runtime;
            }
        }

        if (runtime.phase === 'moving') {
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            const movementProgress = flightProgressAt(runtime, progress);
            const nextPosition = flightPositionAt(runtime, movementProgress);

            group.position.copy(nextPosition);
            facePosition(
                group,
                flightPositionAt(
                    runtime,
                    flightProgressAt(
                        runtime,
                        MathUtils.clamp(
                            progress + beeFlightLookAheadProgress,
                            0,
                            1,
                        ),
                    ),
                ),
                delta,
                beeFlightTurnDamping,
            );
            group.rotation.x = -0.05 + Math.sin(now * 10 + habitat.seed) * 0.04;
            group.rotation.z = Math.sin(now * 8 + habitat.seed) * 0.14;

            if (progress >= 1) {
                runtimeRef.current = makeForagingState({
                    flightYaw: yawTowardPosition(runtime.from, runtime.to),
                    landingPosition: runtime.to.clone(),
                    now,
                    random,
                    target: runtime.target,
                });
            }
        } else {
            const isWander = runtime.target.kind === 'wander';
            if (isWander) {
                const seed = habitat.seed;
                group.position.set(
                    runtime.landingPosition.x +
                        Math.cos(now * 1.7 + seed) * 0.05,
                    runtime.landingPosition.y + Math.sin(now * 3 + seed) * 0.06,
                    runtime.landingPosition.z +
                        Math.sin(now * 2.1 + seed) * 0.05,
                );
                group.rotation.x = -0.05 + Math.sin(now * 6 + seed) * 0.04;
                group.rotation.y =
                    runtime.landingYaw + Math.sin(now * 1.3 + seed) * 0.2;
                group.rotation.z = Math.sin(now * 4.2 + seed) * 0.08;
            } else {
                group.position.copy(foragePositionAt(runtime));
                group.rotation.x = -0.04;
                group.rotation.y = runtime.landingYaw;
                group.rotation.z = 0;
            }

            if (now >= runtime.dwellUntil) {
                const target = chooseNextTarget({
                    currentTarget: runtime.target,
                    habitatCenter: habitat.center,
                    random,
                    targets: habitat.targets,
                });
                runtimeRef.current = makeMovingState({
                    from: group.position.clone(),
                    now,
                    random,
                    target,
                });
            }
        }

        runtime = runtimeRef.current;
        updateBeeRig({
            delta,
            now,
            rig: beeModel.rig,
            runtime,
            seed: habitat.seed,
        });

        if (
            enableDebugHudFlag &&
            runtime &&
            now - lastAnimalDebugUpdateRef.current >= 0.5
        ) {
            lastAnimalDebugUpdateRef.current = now;
            setAnimalDebugEntry(
                createBeeDebugEntry({ group, habitat, now, runtime }),
            );
        }
    });

    return (
        <group ref={groupRef} scale={beeScale}>
            <primitive object={beeModel.scene} />
        </group>
    );
}

function resolveBeeWeather({
    gameWeather,
    weatherDisabled,
    weatherNow,
    weatherOverride,
}: {
    gameWeather: GameState['weather'];
    weatherDisabled: boolean;
    weatherNow: BeeWeather | null | undefined;
    weatherOverride: BeeWeatherOverride | undefined;
}) {
    if (weatherDisabled) {
        return clearBeeWeather;
    }

    if (weatherOverride) {
        return { ...clearBeeWeather, ...weatherOverride };
    }

    if (!weatherNow && !gameWeather) {
        return undefined;
    }

    return { ...clearBeeWeather, ...weatherNow, ...gameWeather };
}

export function Bees({
    garden,
    groundDecorationDensity = 1,
    weather,
    weatherDisabled = false,
}: {
    garden: BeeGarden | null | undefined;
    groundDecorationDensity?: number;
    weather?: BeeWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const { data: blockData } = useBlockData();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const gameWeather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow(!weatherDisabled && !weather);
    const beeWeather = resolveBeeWeather({
        gameWeather,
        weatherDisabled,
        weatherNow,
        weatherOverride: weather,
    });
    const habitats = useMemo(
        () => createBeeHabitats(garden, blockData, groundDecorationDensity),
        [blockData, garden, groundDecorationDensity],
    );

    if (habitats.length <= 0 || !isBeeActive(timeOfDay, beeWeather)) {
        return null;
    }

    return (
        <>
            {habitats.map((habitat) => (
                <Bee key={habitat.id} habitat={habitat} />
            ))}
        </>
    );
}
