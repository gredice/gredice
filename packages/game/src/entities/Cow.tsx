import { resolveCowAppearanceVariant } from '@gredice/js/entityAppearanceVariants';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
    type Group,
    MathUtils,
    type Mesh,
    type Object3D,
    Vector3,
} from 'three';
import { useBlockData } from '../hooks/useBlockData';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState, useGameStateStore } from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useActorGroundingShadow } from './animals/ActorGroundingShadows';
import {
    ActorSpeechBubble,
    useActorHoverSpeech,
} from './animals/ActorSpeechBubble';
import { AnimalPetHearts } from './animals/AnimalPetHearts';
import { configureActorMeshShadows } from './animals/actorMeshShadows';
import { cowSpeechMessages } from './animals/actorSpeechMessages';
import {
    animalAvatarFollowRepathSeconds,
    getAnimalAvatarFollowPosition,
    isFreshGardenAvatarPresence,
} from './animals/animalAvatarFollowing';
import { getAnimalMovementYAt } from './animals/animalMovementTerrain';
import {
    animalPresenceUpdateIntervalSeconds,
    freshAnimalPresences,
} from './animals/animalPresence';
import { recordAnimalProfileCommandAcknowledgement } from './animals/animalProfileCommandMetrics';
import {
    type CowBehavior,
    cowHerdSpacingIsSafe,
    pickCowBehavior,
    resolveCowHerdSpacingTarget,
    shouldCowYieldBlockedHerdPath,
} from './cows/cowBehavior';
import {
    type CowHabitat,
    type CowRuntimeState,
    type CowTarget,
    cowPathPositionAtDistance,
    createCowHabitat,
    createCowRandom,
    makeSettledCowState,
    resolveCowRuntimeForTarget,
} from './cows/cowNavigation';
import { getCowPoseTargets } from './cows/cowPose';

type CowRigNode = {
    basePositionY: number;
    baseRotationX: number;
    baseRotationY: number;
    baseRotationZ: number;
    baseScaleX: number;
    baseScaleY: number;
    baseScaleZ: number;
    object: Object3D | null;
};

type CowRig = {
    body: CowRigNode;
    ears: CowRigNode[];
    head: CowRigNode;
    jaw: CowRigNode;
    legs: CowRigNode[];
    neck: CowRigNode;
    tailBase: CowRigNode;
    tailTip: CowRigNode;
    walkPhase: number;
    walkPoseAmount: number;
};

const fullTurn = Math.PI * 2;
const cowModelScale = 0.66;
const cowPetHeartsOffsetY = 1.28;
const cowSpeechBubbleOffsetY = 1.36;
const cowAvatarResponseSeconds = 7;

function getRigNode(root: Object3D, name: string): CowRigNode {
    const object = root.getObjectByName(name) ?? null;
    return {
        basePositionY: object?.position.y ?? 0,
        baseRotationX: object?.rotation.x ?? 0,
        baseRotationY: object?.rotation.y ?? 0,
        baseRotationZ: object?.rotation.z ?? 0,
        baseScaleX: object?.scale.x ?? 1,
        baseScaleY: object?.scale.y ?? 1,
        baseScaleZ: object?.scale.z ?? 1,
        object,
    };
}

function createCowRig(root: Object3D): CowRig {
    return {
        body: getRigNode(root, 'Cow_BodyPivot'),
        ears: [
            getRigNode(root, 'Cow_EarPivot_L'),
            getRigNode(root, 'Cow_EarPivot_R'),
        ],
        head: getRigNode(root, 'Cow_HeadPivot'),
        jaw: getRigNode(root, 'Cow_JawPivot'),
        legs: [
            getRigNode(root, 'Cow_LegPivot_FL'),
            getRigNode(root, 'Cow_LegPivot_FR'),
            getRigNode(root, 'Cow_LegPivot_RL'),
            getRigNode(root, 'Cow_LegPivot_RR'),
        ],
        neck: getRigNode(root, 'Cow_NeckPivot'),
        tailBase: getRigNode(root, 'Cow_TailPivot_Base'),
        tailTip: getRigNode(root, 'Cow_TailPivot_Tip'),
        walkPhase: 0,
        walkPoseAmount: 0,
    };
}

function poseRigNode(
    node: CowRigNode | undefined,
    delta: number,
    offsets: {
        positionY?: number;
        rotationX?: number;
        rotationY?: number;
        rotationZ?: number;
        scaleX?: number;
        scaleY?: number;
        scaleZ?: number;
    } = {},
) {
    if (!node?.object) {
        return;
    }
    node.object.position.y = MathUtils.damp(
        node.object.position.y,
        node.basePositionY + (offsets.positionY ?? 0),
        8,
        delta,
    );
    node.object.rotation.x = MathUtils.damp(
        node.object.rotation.x,
        node.baseRotationX + (offsets.rotationX ?? 0),
        8,
        delta,
    );
    node.object.rotation.y = MathUtils.damp(
        node.object.rotation.y,
        node.baseRotationY + (offsets.rotationY ?? 0),
        8,
        delta,
    );
    node.object.rotation.z = MathUtils.damp(
        node.object.rotation.z,
        node.baseRotationZ + (offsets.rotationZ ?? 0),
        8,
        delta,
    );
    node.object.scale.x = MathUtils.damp(
        node.object.scale.x,
        node.baseScaleX * (offsets.scaleX ?? 1),
        8,
        delta,
    );
    node.object.scale.y = MathUtils.damp(
        node.object.scale.y,
        node.baseScaleY * (offsets.scaleY ?? 1),
        8,
        delta,
    );
    node.object.scale.z = MathUtils.damp(
        node.object.scale.z,
        node.baseScaleZ * (offsets.scaleZ ?? 1),
        8,
        delta,
    );
}

function updateCowPose({
    behavior,
    delta,
    moving,
    now,
    rig,
    walkDistance,
}: {
    behavior: CowBehavior;
    delta: number;
    moving: boolean;
    now: number;
    rig: CowRig;
    walkDistance: number;
}) {
    const trot = behavior === 'trot' && moving;
    rig.walkPoseAmount = MathUtils.damp(
        rig.walkPoseAmount,
        moving ? 1 : 0,
        trot ? 9 : 7,
        delta,
    );
    if (moving) {
        rig.walkPhase = (walkDistance / (trot ? 0.78 : 0.92)) * fullTurn;
    }
    const targets = getCowPoseTargets({
        behavior,
        moving: rig.walkPoseAmount > 0.01,
        now,
        trot,
        walkPhase: rig.walkPhase,
    });
    poseRigNode(rig.body, delta, {
        positionY: targets.bodyPositionY * rig.walkPoseAmount,
        scaleY: targets.bodyScaleY,
        scaleZ: targets.bodyScaleZ,
    });
    poseRigNode(rig.neck, delta, {
        rotationX: targets.neckRotationX,
    });
    poseRigNode(rig.head, delta, {
        rotationX: targets.headRotationX,
        rotationZ: targets.headRotationZ,
    });
    poseRigNode(rig.jaw, delta, { rotationY: targets.jawRotationY });
    rig.ears.forEach((ear, index) => {
        poseRigNode(ear, delta, {
            rotationZ:
                targets.earRotationZ * (index === 0 ? 1 : -1) +
                Math.sin(now * 5.7 + index * 2.2) * 0.025,
        });
    });
    rig.legs.forEach((leg, index) => {
        poseRigNode(leg, delta, {
            rotationX: (targets.legRotations[index] ?? 0) * rig.walkPoseAmount,
        });
    });
    poseRigNode(rig.tailBase, delta, {
        rotationY: targets.tailBaseRotationY,
    });
    poseRigNode(rig.tailTip, delta, {
        rotationY: targets.tailTipRotationY,
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
    group.rotation.y += difference * (1 - Math.exp(-5 * delta));
}

function chooseCowTarget({
    behavior,
    currentPosition,
    habitat,
    neighbors,
    random,
}: {
    behavior: CowBehavior;
    currentPosition: Vector3;
    habitat: CowHabitat;
    neighbors: Array<{ id: string; position: { x: number; z: number } }>;
    random: () => number;
}) {
    if (
        behavior === 'idle' ||
        behavior === 'graze' ||
        behavior === 'chew-cud'
    ) {
        return {
            behavior,
            id: `${behavior}-${habitat.id}`,
            position: currentPosition.clone(),
        } satisfies CowTarget;
    }
    const anchor =
        habitat.roamAnchors[
            Math.floor(random() * habitat.roamAnchors.length)
        ] ?? habitat.home;
    const angle = random() * fullTurn;
    const radius = 0.08 + random() * 0.18;
    const candidate = {
        x: anchor.position.x + Math.cos(angle) * radius,
        z: anchor.position.z + Math.sin(angle) * radius,
    };
    const spaced = resolveCowHerdSpacingTarget({
        candidate,
        neighbors,
        ownId: habitat.id,
    });
    const position = new Vector3(
        spaced.x,
        getAnimalMovementYAt(spaced, habitat.groundSurfaces),
        spaced.z,
    );
    return {
        behavior,
        facingYaw: angle,
        id: `${behavior}-${anchor.id}-${Math.round(angle * 1000).toString()}`,
        position,
    } satisfies CowTarget;
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

export function Cow({ block, rotation, stack, stacks }: EntityInstanceProps) {
    const { data: blockData } = useBlockData();
    const gltf = useGameGLTF('Cow');
    const gameStateStore = useGameStateStore();
    const groupRef = useRef<Group>(null);
    const runtimeRef = useRef<CowRuntimeState | null>(null);
    const previousHomeKeyRef = useRef('');
    const randomRef = useRef(createCowRandom(0));
    const lastPresenceUpdateRef = useRef(0);
    const lastDebugUpdateRef = useRef(0);
    const lastPetRequestSequenceRef = useRef(0);
    const lastDebugCommandSequenceRef = useRef(0);
    const observeAvatarUntilRef = useRef(Number.NEGATIVE_INFINITY);
    const nextAvatarRepathAtRef = useRef(Number.NEGATIVE_INFINITY);
    const herdSpacingStallSecondsRef = useRef(0);
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
    const { message: speechMessage, showMessage: showSpeechMessage } =
        useActorHoverSpeech(cowSpeechMessages);
    const habitat = useMemo(
        () => createCowHabitat({ block, blockData, stack, stacks }),
        [block, blockData, stack, stacks],
    );
    const appearanceVariant = resolveCowAppearanceVariant(
        block.variant,
        block.id,
    );
    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        const brownPatches = scene.getObjectByName('Cow_Coat_BrownPatches');
        const blackPatches = scene.getObjectByName('Cow_Coat_BlackPatches');
        if (brownPatches) {
            brownPatches.visible = appearanceVariant === 0;
        }
        if (blackPatches) {
            blackPatches.visible = appearanceVariant === 1;
        }
        const { primaryCasterCount } = configureActorMeshShadows(
            scene,
            (mesh: Mesh) => {
                mesh.frustumCulled = false;
                mesh.receiveShadow = true;
            },
        );
        return {
            primaryCasterCount,
            rig: createCowRig(scene),
            scene,
        };
    }, [appearanceVariant, gltf.scene]);
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: habitat.id,
        primaryCasterCount: model.primaryCasterCount,
        species: 'cow',
    });

    useEffect(() => {
        randomRef.current = createCowRandom(habitat.seed);
    }, [habitat.seed]);

    useEffect(() => {
        const homeKey = `${habitat.home.position.x}:${habitat.home.position.y}:${habitat.home.position.z}:${rotation}`;
        if (previousHomeKeyRef.current === homeKey) {
            return;
        }
        previousHomeKeyRef.current = homeKey;
        runtimeRef.current = null;
        const actor = groupRef.current;
        if (actor) {
            actor.position.copy(habitat.home.position);
            actor.rotation.y = habitat.home.facingYaw ?? 0;
        }
    }, [habitat.home, rotation]);

    useEffect(
        () => () => {
            removeAnimalDebugEntry(habitat.id);
            removeAnimalPresenceEntry(habitat.id);
        },
        [habitat.id, removeAnimalDebugEntry, removeAnimalPresenceEntry],
    );

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }
        const now = clock.elapsedTime;
        const random = randomRef.current;
        let runtime = runtimeRef.current;
        if (!runtime) {
            runtime = makeSettledCowState({
                now,
                random,
                target: habitat.home,
            });
            runtimeRef.current = runtime;
            group.position.copy(habitat.home.position);
            group.rotation.y = habitat.home.facingYaw ?? 0;
        }

        const gameState = gameStateStore.getState();
        const neighbors = freshAnimalPresences({
            entries: gameState.animalPresenceEntries,
            now,
            species: 'Cow',
        }).map((entry) => ({
            id: entry.id,
            position: entry.position,
        }));
        const petRequest = gameState.gardenAvatarAnimalPetRequest;
        if (
            petRequest &&
            petRequest.sequence !== lastPetRequestSequenceRef.current
        ) {
            lastPetRequestSequenceRef.current = petRequest.sequence;
            if (
                petRequest.species === 'Cow' &&
                petRequest.targetId === habitat.id
            ) {
                observeAvatarUntilRef.current = now + cowAvatarResponseSeconds;
                nextAvatarRepathAtRef.current = Number.NEGATIVE_INFINITY;
                showSpeechMessage();
            }
        }

        if (
            now < observeAvatarUntilRef.current &&
            now >= nextAvatarRepathAtRef.current &&
            isFreshGardenAvatarPresence(gameState.gardenAvatarPresence, now)
        ) {
            const candidate = getAnimalAvatarFollowPosition(
                gameState.gardenAvatarPresence,
                1.55,
            );
            const spaced = resolveCowHerdSpacingTarget({
                candidate,
                neighbors,
                ownId: habitat.id,
            });
            const target = {
                behavior: 'observe-avatar',
                id: `observe-avatar-${habitat.id}`,
                lookAtPosition: new Vector3(
                    gameState.gardenAvatarPresence.position.x,
                    gameState.gardenAvatarPresence.position.y + 0.8,
                    gameState.gardenAvatarPresence.position.z,
                ),
                position: new Vector3(
                    spaced.x,
                    getAnimalMovementYAt(spaced, habitat.groundSurfaces),
                    spaced.z,
                ),
            } satisfies CowTarget;
            runtime = resolveCowRuntimeForTarget({
                from: group.position,
                habitat,
                now,
                random,
                target,
            });
            runtimeRef.current = runtime;
            herdSpacingStallSecondsRef.current = 0;
            nextAvatarRepathAtRef.current =
                now + animalAvatarFollowRepathSeconds + 0.35;
        }

        const debugCommand = gameState.animalDebugCommand;
        if (
            debugCommand &&
            debugCommand.sequence !== lastDebugCommandSequenceRef.current &&
            debugCommand.species === 'Cow'
        ) {
            lastDebugCommandSequenceRef.current = debugCommand.sequence;
            const allowedBehaviors: CowBehavior[] = [
                'idle',
                'graze',
                'chew-cud',
                'roam',
                'trot',
            ];
            if (
                (!debugCommand.targetId ||
                    debugCommand.targetId === habitat.id) &&
                allowedBehaviors.some(
                    (behavior) => behavior === debugCommand.behavior,
                )
            ) {
                const behavior = allowedBehaviors.find(
                    (candidate) => candidate === debugCommand.behavior,
                );
                if (behavior) {
                    const target = chooseCowTarget({
                        behavior,
                        currentPosition: group.position,
                        habitat,
                        neighbors,
                        random,
                    });
                    runtime = resolveCowRuntimeForTarget({
                        from: group.position,
                        habitat,
                        now,
                        random,
                        target,
                    });
                    runtimeRef.current = runtime;
                    herdSpacingStallSecondsRef.current = 0;
                    recordAnimalProfileCommandAcknowledgement({
                        actorId: habitat.id,
                        behavior: runtime.target.behavior,
                        moving: runtime.phase === 'moving',
                        sequence: debugCommand.sequence,
                        species: 'Cow',
                    });
                }
            }
        }

        let walkDistance = 0;
        if (runtime.phase === 'moving') {
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.duration,
                0,
                1,
            );
            walkDistance = runtime.pathDistance * progress;
            const nextPosition = cowPathPositionAtDistance(
                runtime.path,
                walkDistance,
            );
            nextPosition.y = getAnimalMovementYAt(
                nextPosition,
                habitat.groundSurfaces,
            );
            if (
                cowHerdSpacingIsSafe(nextPosition, neighbors, habitat.id) ||
                progress >= 1
            ) {
                group.position.copy(nextPosition);
                herdSpacingStallSecondsRef.current = 0;
                facePosition(
                    group,
                    cowPathPositionAtDistance(
                        runtime.path,
                        Math.min(runtime.pathDistance, walkDistance + 0.14),
                    ),
                    delta,
                );
            } else {
                runtime.startedAt += delta;
                herdSpacingStallSecondsRef.current += delta;
                if (
                    shouldCowYieldBlockedHerdPath(
                        herdSpacingStallSecondsRef.current,
                    )
                ) {
                    runtime = makeSettledCowState({
                        now,
                        random,
                        target: runtime.target,
                    });
                    runtimeRef.current = runtime;
                    herdSpacingStallSecondsRef.current = 0;
                }
            }
            if (runtime.phase === 'moving' && progress >= 1) {
                group.position.copy(runtime.to);
                runtime = makeSettledCowState({
                    now,
                    random,
                    target: runtime.target,
                });
                runtimeRef.current = runtime;
                herdSpacingStallSecondsRef.current = 0;
            }
        } else {
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
            if (
                now >= runtime.dwellUntil &&
                now >= observeAvatarUntilRef.current
            ) {
                const target = chooseCowTarget({
                    behavior: pickCowBehavior(random),
                    currentPosition: group.position,
                    habitat,
                    neighbors,
                    random,
                });
                runtime = resolveCowRuntimeForTarget({
                    from: group.position,
                    habitat,
                    now,
                    random,
                    target,
                });
                runtimeRef.current = runtime;
                herdSpacingStallSecondsRef.current = 0;
            }
        }

        const activeRuntime = runtimeRef.current ?? runtime;
        updateCowPose({
            behavior: activeRuntime.target.behavior,
            delta,
            moving: activeRuntime.phase === 'moving',
            now,
            rig: model.rig,
            walkDistance,
        });
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
                behavior: activeRuntime.target.behavior,
                id: habitat.id,
                position: roundPoint(group.position),
                species: 'Cow',
                updatedAt: now,
            });
        }
        if (now - lastDebugUpdateRef.current >= 0.5) {
            lastDebugUpdateRef.current = now;
            setAnimalDebugEntry({
                activity:
                    activeRuntime.phase === 'moving'
                        ? `moving to ${activeRuntime.target.behavior}`
                        : activeRuntime.target.behavior,
                behavior: activeRuntime.target.behavior,
                debugBehaviors: ['idle', 'graze', 'chew-cud', 'roam', 'trot'],
                id: habitat.id,
                label: block.id,
                pathfinding:
                    activeRuntime.phase === 'moving'
                        ? {
                              blockedCellCount:
                                  activeRuntime.pathfinding.blockedCellCount,
                              distance: roundCoordinate(
                                  activeRuntime.pathDistance,
                              ),
                              status: activeRuntime.pathfinding.status,
                              targetCell: activeRuntime.pathfinding.targetCell,
                              visitedCellCount:
                                  activeRuntime.pathfinding.visitedCellCount,
                              waypointCount: activeRuntime.path.length,
                          }
                        : undefined,
                phase: activeRuntime.phase,
                position: roundPoint(group.position),
                species: 'Cow',
                targetId: activeRuntime.target.id,
                updatedAt: now,
            });
        }
    });

    return (
        <>
            <group
                ref={groupRef}
                onPointerOver={showSpeechMessage}
                scale={cowModelScale}
            >
                <primitive object={model.scene} />
            </group>
            <AnimalPetHearts
                actorRef={groupRef}
                offsetY={cowPetHeartsOffsetY}
                targetId={habitat.id}
            />
            {speechMessage ? (
                <ActorSpeechBubble
                    actorRef={groupRef}
                    message={speechMessage}
                    offsetY={cowSpeechBubbleOffsetY}
                />
            ) : null}
        </>
    );
}
