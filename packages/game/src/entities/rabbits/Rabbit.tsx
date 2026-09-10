'use client';

import { resolveRabbitAppearanceVariant } from '@gredice/js/entityAppearanceVariants';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
    type Euler,
    type Group,
    MathUtils,
    type Mesh,
    MeshStandardMaterial,
    type Object3D,
    Vector3 as ThreeVector3,
    type Vector3,
} from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useGameStateStore } from '../../useGameState';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import { isFreshGardenAvatarPresence } from '../animals/animalAvatarFollowing';
import {
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
} from '../animals/animalMovementTerrain';
import {
    createPersistentPetHomeBlockedCells,
    getPersistentPetHomePlacement,
} from '../persistentPets/persistentPetHomes';
import {
    getRabbitDwellSeconds,
    pickRabbitSettledBehavior,
    type RabbitSettledBehavior,
    rabbitFleeDistance,
    rabbitFleeHopSpeed,
    rabbitFleeSafeDistance,
    rabbitHomeRange,
    rabbitHopSpeed,
    shouldRabbitRoam,
} from './rabbitBehavior';
import {
    findRabbitFleePath,
    findRabbitPath,
    type RabbitNavigationPoint,
} from './rabbitNavigation';

type RabbitMovementBehavior = 'flee' | 'hop';

type MovingRabbitState = {
    behavior: RabbitMovementBehavior;
    distanceTravelled: number;
    path: ThreeVector3[];
    phase: 'moving';
    waypointIndex: number;
};

type SettledRabbitState = {
    behavior: RabbitSettledBehavior;
    dwellUntil: number;
    phase: 'settled';
};

type RabbitRuntimeState = MovingRabbitState | SettledRabbitState;

type RabbitRigPart = {
    basePosition: Vector3;
    baseRotation: Euler;
    baseScale: Vector3;
    object: Object3D;
};

type RabbitRig = {
    body: RabbitRigPart;
    earLeft: RabbitRigPart;
    earRight: RabbitRigPart;
    frontLeft: RabbitRigPart;
    frontRight: RabbitRigPart;
    head: RabbitRigPart;
    hindLeft: RabbitRigPart;
    hindRight: RabbitRigPart;
    nose: RabbitRigPart;
    tail: RabbitRigPart;
};

const rabbitScale = 0.55 * 0.6;
const rabbitGroundLift = 0.015;
const rabbitHopStride = 0.42;
const rabbitRoamCandidateCount = 10;
const rabbitTurnDamping = 10;
const rabbitPoseDamping = 10;
const rabbitFleeAttemptInterval = 0.22;
const fullTurn = Math.PI * 2;

const rabbitCoatPalettes = {
    0: {
        innerEar: '#bd6f71',
        primary: '#87532f',
        secondary: '#d0ac7c',
    },
    1: {
        innerEar: '#cf8d87',
        primary: '#b89462',
        secondary: '#ddc28f',
    },
} as const;

function hashString(value: string) {
    let hash = 2_166_136_261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
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
        return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function rigPart(object: Object3D): RabbitRigPart {
    return {
        basePosition: object.position.clone(),
        baseRotation: object.rotation.clone(),
        baseScale: object.scale.clone(),
        object,
    };
}

function createRabbitRig(scene: Object3D): RabbitRig | null {
    const body = scene.getObjectByName('Rabbit_BodyPivot');
    const earLeft = scene.getObjectByName('Rabbit_EarPivot_L');
    const earRight = scene.getObjectByName('Rabbit_EarPivot_R');
    const frontLeft = scene.getObjectByName('Rabbit_LegPivot_FL');
    const frontRight = scene.getObjectByName('Rabbit_LegPivot_FR');
    const head = scene.getObjectByName('Rabbit_HeadPivot');
    const hindLeft = scene.getObjectByName('Rabbit_LegPivot_HL');
    const hindRight = scene.getObjectByName('Rabbit_LegPivot_HR');
    const nose = scene.getObjectByName('Rabbit_NosePivot');
    const tail = scene.getObjectByName('Rabbit_TailPivot');

    if (
        !body ||
        !earLeft ||
        !earRight ||
        !frontLeft ||
        !frontRight ||
        !head ||
        !hindLeft ||
        !hindRight ||
        !nose ||
        !tail
    ) {
        return null;
    }

    return {
        body: rigPart(body),
        earLeft: rigPart(earLeft),
        earRight: rigPart(earRight),
        frontLeft: rigPart(frontLeft),
        frontRight: rigPart(frontRight),
        head: rigPart(head),
        hindLeft: rigPart(hindLeft),
        hindRight: rigPart(hindRight),
        nose: rigPart(nose),
        tail: rigPart(tail),
    };
}

function configureRabbitMaterial(
    mesh: Mesh,
    palette: (typeof rabbitCoatPalettes)[keyof typeof rabbitCoatPalettes],
) {
    if (!(mesh.material instanceof MeshStandardMaterial)) {
        return null;
    }

    const material = mesh.material.clone();
    if (material.name === 'Material.Rabbit.FurPrimary') {
        material.color.set(palette.primary);
    } else if (material.name === 'Material.Rabbit.FurSecondary') {
        material.color.set(palette.secondary);
    } else if (material.name === 'Material.Rabbit.InnerEar') {
        material.color.set(palette.innerEar);
    }
    mesh.material = material;
    return material;
}

function horizontalDistance(
    left: Pick<Vector3, 'x' | 'z'>,
    right: Pick<Vector3, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function cellKey(position: Pick<Vector3, 'x' | 'z'>) {
    return `${Math.round(position.x)}:${Math.round(position.z)}`;
}

function shortestAngleDelta(from: number, to: number) {
    return MathUtils.euclideanModulo(to - from + Math.PI, fullTurn) - Math.PI;
}

function faceMovement(group: Group, target: Vector3, delta: number) {
    const dx = target.x - group.position.x;
    const dz = target.z - group.position.z;
    if (Math.hypot(dx, dz) <= 0.001) {
        return;
    }
    const targetYaw = Math.atan2(dx, dz);
    group.rotation.y +=
        shortestAngleDelta(group.rotation.y, targetYaw) *
        (1 - Math.exp(-rabbitTurnDamping * delta));
}

function dampPart(
    part: RabbitRigPart,
    delta: number,
    {
        positionY = 0,
        rotationX = 0,
        rotationY = 0,
        rotationZ = 0,
        scale = 1,
    }: {
        positionY?: number;
        rotationX?: number;
        rotationY?: number;
        rotationZ?: number;
        scale?: number;
    } = {},
) {
    const { object } = part;
    object.position.y = MathUtils.damp(
        object.position.y,
        part.basePosition.y + positionY,
        rabbitPoseDamping,
        delta,
    );
    object.rotation.x = MathUtils.damp(
        object.rotation.x,
        part.baseRotation.x + rotationX,
        rabbitPoseDamping,
        delta,
    );
    object.rotation.y = MathUtils.damp(
        object.rotation.y,
        part.baseRotation.y + rotationY,
        rabbitPoseDamping,
        delta,
    );
    object.rotation.z = MathUtils.damp(
        object.rotation.z,
        part.baseRotation.z + rotationZ,
        rabbitPoseDamping,
        delta,
    );
    object.scale.set(
        MathUtils.damp(
            object.scale.x,
            part.baseScale.x * scale,
            rabbitPoseDamping,
            delta,
        ),
        MathUtils.damp(
            object.scale.y,
            part.baseScale.y * scale,
            rabbitPoseDamping,
            delta,
        ),
        MathUtils.damp(
            object.scale.z,
            part.baseScale.z * scale,
            rabbitPoseDamping,
            delta,
        ),
    );
}

function animateRabbitRig({
    delta,
    rig,
    runtime,
    time,
}: {
    delta: number;
    rig: RabbitRig;
    runtime: RabbitRuntimeState;
    time: number;
}) {
    const moving = runtime.phase === 'moving';
    const fleeing = moving && runtime.behavior === 'flee';
    const hopPhase = moving
        ? (runtime.distanceTravelled / rabbitHopStride) * Math.PI
        : 0;
    const hop = moving ? Math.abs(Math.sin(hopPhase)) : 0;
    const stride = moving ? Math.sin(hopPhase) : 0;
    const sniffing =
        runtime.phase === 'settled' && runtime.behavior === 'sniff';
    const grooming =
        runtime.phase === 'settled' && runtime.behavior === 'groom';
    const nibbling =
        runtime.phase === 'settled' && runtime.behavior === 'nibble';
    const sitting = runtime.phase === 'settled' && runtime.behavior === 'sit';
    const noseTwitch = sniffing || nibbling ? Math.sin(time * 18) * 0.055 : 0;
    const earTwitchLeft = Math.sin(time * 2.7 + 0.8) * 0.055;
    const earTwitchRight = Math.sin(time * 3.1 + 2.2) * 0.048;

    dampPart(rig.body, delta, {
        positionY: moving ? hop * 0.12 : sitting ? -0.025 : 0,
        rotationX: moving ? stride * 0.12 : nibbling ? 0.12 : 0,
    });
    dampPart(rig.head, delta, {
        positionY: grooming ? -0.08 : nibbling ? -0.055 : 0,
        rotationX: grooming ? 0.72 : nibbling ? 0.5 : sniffing ? 0.08 : 0,
        rotationZ: grooming ? Math.sin(time * 4.2) * 0.16 : 0,
    });
    dampPart(rig.nose, delta, { scale: 1 + noseTwitch });
    dampPart(rig.earLeft, delta, {
        rotationX: fleeing ? -0.72 : grooming ? -0.2 : earTwitchLeft,
        rotationZ: fleeing ? 0.18 : earTwitchLeft * 0.7,
    });
    dampPart(rig.earRight, delta, {
        rotationX: fleeing ? -0.66 : grooming ? -0.12 : earTwitchRight,
        rotationZ: fleeing ? -0.18 : -earTwitchRight * 0.7,
    });
    dampPart(rig.frontLeft, delta, {
        positionY: grooming ? 0.09 : 0,
        rotationX: moving ? -0.5 * stride : grooming ? -0.82 : 0,
    });
    dampPart(rig.frontRight, delta, {
        positionY: grooming ? 0.07 : 0,
        rotationX: moving ? -0.5 * stride : grooming ? -0.68 : 0,
    });
    dampPart(rig.hindLeft, delta, {
        rotationX: moving ? 0.68 * stride : sitting ? 0.12 : 0,
    });
    dampPart(rig.hindRight, delta, {
        rotationX: moving ? 0.68 * stride : sitting ? 0.12 : 0,
    });
    dampPart(rig.tail, delta, {
        rotationX: moving ? -0.15 * stride : Math.sin(time * 2.1) * 0.04,
    });
}

function makeSettledState(
    random: () => number,
    now: number,
    behavior = pickRabbitSettledBehavior(random),
): SettledRabbitState {
    return {
        behavior,
        dwellUntil: now + getRabbitDwellSeconds(behavior, random),
        phase: 'settled',
    };
}

function makeMovingState(
    behavior: RabbitMovementBehavior,
    path: RabbitNavigationPoint[],
): MovingRabbitState {
    return {
        behavior,
        distanceTravelled: 0,
        path: path.map(({ x, y, z }) => new ThreeVector3(x, y, z)),
        phase: 'moving',
        waypointIndex: 1,
    };
}

function shuffledCandidates(
    candidates: RabbitNavigationPoint[],
    random: () => number,
) {
    return candidates
        .map((candidate) => ({ candidate, order: random() }))
        .sort((left, right) => left.order - right.order)
        .slice(0, rabbitRoamCandidateCount)
        .map(({ candidate }) => candidate);
}

export function Rabbit({
    block,
    rotation,
    stack,
    stacks,
    variant,
}: EntityInstanceProps) {
    const gltf = useGameGLTF('Rabbit');
    const clock = useThree((state) => state.clock);
    const { data: blockData } = useBlockData();
    const gameStateStore = useGameStateStore();
    const currentStackHeight = useStackHeight(stack, block);
    const groupRef = useRef<Group | null>(null);
    const runtimeRef = useRef<RabbitRuntimeState | null>(null);
    const nextFleeAttemptAtRef = useRef(Number.NEGATIVE_INFINITY);
    const randomRef = useRef(createRandom(hashString(block.id)));
    const homePlacement =
        block.name === 'RabbitHutch'
            ? getPersistentPetHomePlacement({
                  blockName: 'RabbitHutch',
                  rotation,
                  x: stack.position.x,
                  z: stack.position.z,
              })
            : null;
    const homeAnchor = useMemo(
        () =>
            new ThreeVector3(
                homePlacement?.doorway.x ?? stack.position.x,
                currentStackHeight + rabbitGroundLift,
                homePlacement?.doorway.z ?? stack.position.z,
            ),
        [
            currentStackHeight,
            homePlacement?.doorway.x,
            homePlacement?.doorway.z,
            stack.position.x,
            stack.position.z,
        ],
    );
    const persistedVariant = resolveRabbitAppearanceVariant(
        block.variant ?? variant,
        block.id,
    );
    const palette =
        persistedVariant === 1 ? rabbitCoatPalettes[1] : rabbitCoatPalettes[0];
    const rabbitModel = useMemo(() => {
        const scene = gltf.scene.clone(true);
        const materials: MeshStandardMaterial[] = [];
        const { primaryCasterCount } = configureActorMeshShadows(
            scene,
            (mesh) => {
                const material = configureRabbitMaterial(mesh, palette);
                if (material) {
                    materials.push(material);
                }
            },
        );
        return {
            materials,
            primaryCasterCount,
            rig: createRabbitRig(scene),
            scene,
        };
    }, [gltf.scene, palette]);
    const habitat = useMemo(() => {
        const surfaces = createAnimalMovementSurfaces({
            blockData,
            groundLift: rabbitGroundLift,
            stacks,
            swimDepth: 0,
        }).filter((surface) => surface.kind === 'ground');
        if (surfaces.length === 0) {
            surfaces.push({
                kind: 'ground',
                x: homeAnchor.x,
                y: homeAnchor.y,
                z: homeAnchor.z,
            });
        }

        const home = homeAnchor.clone();
        const homeSurface = getAnimalMovementSurfaceAt(home, surfaces);
        if (homeSurface?.kind === 'ground') {
            home.y = Math.max(rabbitGroundLift, homeSurface.y);
        }
        const homeCellKey = cellKey(home);
        const blockedCells =
            block.name === 'RabbitHutch'
                ? createPersistentPetHomeBlockedCells({
                      block,
                      blockData,
                      stack,
                      stacks,
                  })
                : createAnimalBlockedCells(stacks, { blockData }).filter(
                      (cell) => cellKey(cell) !== homeCellKey,
                  );
        const blockedKeys = new Set(blockedCells.map(cellKey));
        const candidates = surfaces
            .filter(
                (surface) =>
                    !blockedKeys.has(cellKey(surface)) &&
                    horizontalDistance(surface, home) <= rabbitHomeRange,
            )
            .map(({ x, y, z }) => ({ x, y, z }));

        return { blockedCells, candidates, groundSurfaces: surfaces, home };
    }, [block, blockData, homeAnchor, stack, stacks]);
    const home = habitat.home;
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: `rabbit:${block.id}`,
        primaryCasterCount: rabbitModel.primaryCasterCount,
        species: 'rabbit',
    });
    useSceneTimeInvalidation('fauna:rabbits', true, sceneFrameRates.ambient);

    useEffect(() => {
        const group = groupRef.current;
        if (!group) {
            return;
        }
        group.position.copy(home);
        group.rotation.y = homePlacement?.facingYaw ?? rotation * (Math.PI / 2);
        runtimeRef.current = makeSettledState(
            randomRef.current,
            clock.getElapsedTime(),
            'sniff',
        );
        nextFleeAttemptAtRef.current = Number.NEGATIVE_INFINITY;
    }, [clock, home, homePlacement?.facingYaw, rotation]);

    useEffect(
        () => () => {
            for (const material of rabbitModel.materials) {
                material.dispose();
            }
        },
        [rabbitModel.materials],
    );

    useEffect(() => {
        const group = groupRef.current;
        const runtime = runtimeRef.current;
        if (!group || runtime?.phase !== 'moving') {
            return;
        }
        const destination = runtime.path.at(-1);
        if (!destination) {
            return;
        }
        const replacement = findRabbitPath({
            blockedCells: habitat.blockedCells,
            from: group.position,
            groundSurfaces: habitat.groundSurfaces,
            to: destination,
        });
        runtimeRef.current =
            replacement.status === 'unreachable'
                ? makeSettledState(
                      randomRef.current,
                      clock.getElapsedTime(),
                      'sit',
                  )
                : makeMovingState(runtime.behavior, replacement.points);
    }, [clock, habitat]);

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }
        const now = clock.elapsedTime;
        const random = randomRef.current;
        let runtime = runtimeRef.current;
        if (!runtime) {
            group.position.copy(home);
            runtime = makeSettledState(random, now, 'sniff');
            runtimeRef.current = runtime;
        }

        const { gardenAvatarPresence } = gameStateStore.getState();
        const avatarIsNearby =
            isFreshGardenAvatarPresence(gardenAvatarPresence, now) &&
            horizontalDistance(group.position, gardenAvatarPresence.position) <=
                rabbitFleeDistance;
        if (
            avatarIsNearby &&
            runtime.behavior !== 'flee' &&
            now >= nextFleeAttemptAtRef.current
        ) {
            const safeCandidates = habitat.candidates.filter(
                (candidate) =>
                    horizontalDistance(
                        candidate,
                        gardenAvatarPresence.position,
                    ) >= rabbitFleeSafeDistance,
            );
            const fleePath = findRabbitFleePath({
                avatar: gardenAvatarPresence.position,
                blockedCells: habitat.blockedCells,
                candidates:
                    safeCandidates.length > 0
                        ? safeCandidates
                        : habitat.candidates,
                from: group.position,
                groundSurfaces: habitat.groundSurfaces,
                home,
                homeRange: rabbitHomeRange,
            });
            if (fleePath) {
                runtime = makeMovingState('flee', fleePath.points);
                runtimeRef.current = runtime;
            }
            nextFleeAttemptAtRef.current = now + rabbitFleeAttemptInterval;
        }

        if (runtime.phase === 'moving') {
            const waypoint = runtime.path[runtime.waypointIndex];
            if (!waypoint) {
                const surface = getAnimalMovementSurfaceAt(
                    group.position,
                    habitat.groundSurfaces,
                );
                if (surface?.kind === 'ground') {
                    group.position.y = surface.y;
                }
                runtime = makeSettledState(
                    random,
                    now,
                    runtime.behavior === 'flee' ? 'sniff' : undefined,
                );
                runtimeRef.current = runtime;
            } else {
                const dx = waypoint.x - group.position.x;
                const dz = waypoint.z - group.position.z;
                const distance = Math.hypot(dx, dz);
                const speed =
                    runtime.behavior === 'flee'
                        ? rabbitFleeHopSpeed
                        : rabbitHopSpeed;
                const step = Math.min(distance, speed * delta);
                if (distance > 0.0001) {
                    group.position.x += (dx / distance) * step;
                    group.position.z += (dz / distance) * step;
                    runtime.distanceTravelled += step;
                    faceMovement(group, waypoint, delta);
                }
                const surface = getAnimalMovementSurfaceAt(
                    group.position,
                    habitat.groundSurfaces,
                );
                if (surface?.kind !== 'ground') {
                    group.position.copy(home);
                    runtime = makeSettledState(random, now, 'sit');
                    runtimeRef.current = runtime;
                } else {
                    const hopPhase =
                        (runtime.distanceTravelled / rabbitHopStride) * Math.PI;
                    const hopHeight = runtime.behavior === 'flee' ? 0.19 : 0.13;
                    group.position.y =
                        surface.y + Math.abs(Math.sin(hopPhase)) * hopHeight;
                    if (distance <= step + 0.001) {
                        group.position.x = waypoint.x;
                        group.position.z = waypoint.z;
                        runtime.waypointIndex += 1;
                    }
                }
            }
        } else if (now >= runtime.dwellUntil) {
            let movingState: MovingRabbitState | null = null;
            if (shouldRabbitRoam(random)) {
                for (const candidate of shuffledCandidates(
                    habitat.candidates,
                    random,
                )) {
                    if (horizontalDistance(candidate, group.position) < 0.7) {
                        continue;
                    }
                    const path = findRabbitPath({
                        blockedCells: habitat.blockedCells,
                        from: group.position,
                        groundSurfaces: habitat.groundSurfaces,
                        to: candidate,
                    });
                    if (path.status !== 'unreachable') {
                        movingState = makeMovingState('hop', path.points);
                        break;
                    }
                }
            }
            runtime = movingState ?? makeSettledState(random, now);
            runtimeRef.current = runtime;
        }

        if (rabbitModel.rig) {
            animateRabbitRig({
                delta,
                rig: rabbitModel.rig,
                runtime,
                time: now,
            });
        }

        const receiver = getAnimalMovementSurfaceAt(
            group.position,
            habitat.groundSurfaces,
        );
        updateActorGroundingShadow?.({
            actorY: group.position.y,
            receiverY: receiver?.y ?? home.y,
            visible: receiver?.kind === 'ground',
            x: group.position.x,
            yaw: group.rotation.y,
            z: group.position.z,
        });
    });

    return (
        <group ref={groupRef}>
            <group scale={rabbitScale}>
                <primitive object={rabbitModel.scene} />
            </group>
        </group>
    );
}
