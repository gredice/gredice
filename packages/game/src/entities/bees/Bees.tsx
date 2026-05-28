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
import { useIsEditMode } from '../../hooks/useIsEditMode';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import type { Stack } from '../../types/Stack';
import {
    type AnimalDebugEntry,
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
import { tulipBouquetStems } from '../tulipBouquet';
import {
    type BeeWeather,
    getBeeCount,
    getBeeDwellSeconds,
    isBeeActive,
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
    kind: 'flower' | 'raised-bed-flower';
    position: Vector3;
};

type BeeHabitat = {
    id: string;
    seed: number;
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
    dipPhase: number;
    dwellUntil: number;
    orbitDirection: -1 | 1;
    orbitPhase: number;
    orbitRadius: number;
    orbitSpeed: number;
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

const beeScale = 0.16;
const beeFlightSpeedBlocksPerSecond = 1.1;
const beeFlightTurnDamping = 7.5;
const beeFlightLookAheadProgress = 0.06;
const beeFlightArcMaxHeight = 0.42;
const beeForageHoverHeight = 0.08;
const defaultTurnDamping = 9;
const raisedBedFlowerHoverHeight = 0.42;
const tulipFlowerHoverHeight = 0.52;
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
        (field.plantStatus === 'sprouted' || field.plantStatus === 'ready')
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

function createFlowerTargets(
    garden: BeeGarden,
    blockData: BlockData[] | null | undefined,
) {
    return [
        ...createTulipTargets(garden.stacks, blockData),
        ...createRaisedBedTargets(garden, blockData),
    ];
}

function createBeeHabitats(
    garden: BeeGarden | null | undefined,
    blockData: BlockData[] | null | undefined,
) {
    if (!garden) {
        return [];
    }

    const targets = createFlowerTargets(garden, blockData);
    const beeCount = getBeeCount(targets.length);
    const firstTarget = targets[0];
    if (!firstTarget) {
        return [];
    }

    return Array.from({ length: beeCount }, (_, index) => {
        const seed = hashString(
            `${garden.id ?? 'garden'}-bee-${index}-${targets.length}`,
        );
        const random = createRandom(seed);
        return {
            id: `bee-${index + 1}`,
            seed,
            startTarget:
                targets[Math.floor(random() * targets.length)] ?? firstTarget,
            targets,
        } satisfies BeeHabitat;
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

function chooseNextTarget({
    currentTarget,
    random,
    targets,
}: {
    currentTarget: BeeTarget;
    random: () => number;
    targets: BeeTarget[];
}) {
    const nearbyTargets = targets.filter(
        (target) =>
            target.id !== currentTarget.id &&
            horizontalDistance(target.position, currentTarget.position) <= 6,
    );
    const fallbackTargets = targets.filter(
        (target) => target.id !== currentTarget.id,
    );

    return (
        pickCandidate(
            nearbyTargets.length > 0 ? nearbyTargets : fallbackTargets,
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
    const targetJitterRadius = 0.035 + random() * 0.04;
    const targetJitterAngle = random() * fullTurn;
    const to = target.position
        .clone()
        .add(
            new Vector3(
                Math.cos(targetJitterAngle) * targetJitterRadius,
                beeForageHoverHeight + random() * 0.035,
                Math.sin(targetJitterAngle) * targetJitterRadius,
            ),
        );
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

function makeForagingState({
    now,
    random,
    target,
}: {
    now: number;
    random: () => number;
    target: BeeTarget;
}) {
    return {
        phase: 'foraging',
        dipPhase: random() * fullTurn,
        dwellUntil: now + getBeeDwellSeconds(random),
        orbitDirection: random() < 0.5 ? -1 : 1,
        orbitPhase: random() * fullTurn,
        orbitRadius: 0.045 + random() * 0.055,
        orbitSpeed: 4.2 + random() * 2.8,
        startedAt: now,
        target,
    } satisfies ForagingBeeState;
}

function foragePositionAt(runtime: ForagingBeeState, now: number) {
    const elapsed = now - runtime.startedAt;
    const angle =
        runtime.orbitPhase +
        elapsed * runtime.orbitSpeed * runtime.orbitDirection;
    const dip = Math.max(0, Math.sin(elapsed * 5.2 + runtime.dipPhase)) * 0.035;
    return runtime.target.position
        .clone()
        .add(
            new Vector3(
                Math.cos(angle) * runtime.orbitRadius,
                beeForageHoverHeight + Math.sin(elapsed * 8.4) * 0.018 - dip,
                Math.sin(angle) * runtime.orbitRadius * 0.72,
            ),
        );
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
    const flying = runtime?.phase === 'moving';
    const wingSpeed = flying ? 72 : 54;
    const wingPulse = Math.abs(Math.sin(now * wingSpeed + seed));
    const wingLift = 0.24 + wingPulse * (flying ? 1.05 : 0.82);

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

    const forageAmount =
        runtime?.phase === 'foraging'
            ? Math.max(
                  0,
                  Math.sin((now - runtime.startedAt) * 5.2 + runtime.dipPhase),
              )
            : 0;

    if (rig.bodyPivot.object) {
        rig.bodyPivot.object.position.y = MathUtils.damp(
            rig.bodyPivot.object.position.y,
            rig.bodyPivot.basePositionY + Math.sin(now * 8 + seed) * 0.012,
            18,
            delta,
        );
        rig.bodyPivot.object.rotation.x =
            rig.bodyPivot.baseRotationX +
            Math.sin(now * 7.2 + seed) * (flying ? 0.075 : 0.035) -
            forageAmount * 0.05;
        rig.bodyPivot.object.rotation.z =
            rig.bodyPivot.baseRotationZ +
            Math.sin(now * 5.4 + seed) * (flying ? 0.09 : 0.045);
    }

    if (rig.headPivot.object) {
        rig.headPivot.object.rotation.x =
            rig.headPivot.baseRotationX + forageAmount * 0.12;
    }
}

function roundBeeDebugCoordinate(value: number) {
    return Math.round(value * 100) / 100;
}

function getBeeDebugActivity(runtime: BeeRuntimeState) {
    if (runtime.phase === 'moving') {
        return `flying to ${runtime.target.kind}`;
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
    const setAnimalDebugEntry = useGameState(
        (state) => state.setAnimalDebugEntry,
    );
    const removeAnimalDebugEntry = useGameState(
        (state) => state.removeAnimalDebugEntry,
    );

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
            group.position.copy(foragePositionAt(runtime, now));
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
                    now,
                    random,
                    target: runtime.target,
                });
            }
        } else {
            const nextPosition = foragePositionAt(runtime, now);
            group.position.copy(nextPosition);
            facePosition(group, runtime.target.position, delta);
            group.rotation.x = -0.02 + Math.sin(now * 7 + habitat.seed) * 0.025;
            group.rotation.z = Math.sin(now * 6 + habitat.seed) * 0.055;

            if (now >= runtime.dwellUntil) {
                const target = chooseNextTarget({
                    currentTarget: runtime.target,
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
    weather,
    weatherDisabled = false,
}: {
    garden: BeeGarden | null | undefined;
    weather?: BeeWeatherOverride;
    weatherDisabled?: boolean;
}) {
    const { data: blockData } = useBlockData();
    const isEditMode = useIsEditMode();
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
        () => createBeeHabitats(garden, blockData),
        [blockData, garden],
    );

    if (
        isEditMode ||
        habitats.length <= 0 ||
        !isBeeActive(timeOfDay, beeWeather)
    ) {
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
