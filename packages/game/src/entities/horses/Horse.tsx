import {
    getHorseAppearanceVariantDefinition,
    resolveHorseAppearanceVariant,
} from '@gredice/js/entityAppearanceVariants';
import { useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationAction, Group, Material } from 'three';
import {
    LoopOnce,
    LoopRepeat,
    MathUtils,
    type Mesh,
    MeshStandardMaterial,
    Vector3,
} from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useGameState, useGameStateStore } from '../../useGameState';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import { isFreshGardenAvatarPresence } from '../animals/animalAvatarFollowing';
import {
    type AnimalMovementCell,
    type AnimalMovementSurface,
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
    getAnimalMovementYAt,
} from '../animals/animalMovementTerrain';
import { animalPresenceUpdateIntervalSeconds } from '../animals/animalPresence';
import type { CatPathPoint } from '../cats/catPathfinding';
import {
    createPersistentPetHomeBlockedCells,
    getPersistentPetHomePlacement,
} from '../persistentPets/persistentPetHomes';
import { getHorseMaterialTint } from './horseAppearance';
import {
    chooseHorseRetreatTarget,
    createHorseNavigationBlockedCells,
    createHorseRandom,
    getHorseDwellSeconds,
    getHorseMovementAnimation,
    getHorseSettledAnimation,
    type HorseAnimationName,
    type HorseMovement,
    type HorseSettledBehavior,
    horseAvatarAttentionDistance,
    horseAvatarPersonalSpaceDistance,
    horseRoamRange,
    horseTrotSpeed,
    horseWalkSpeed,
    pickHorseSettledBehavior,
    resolveHorseMovement,
} from './horseBehavior';

type SettledHorseState = {
    behavior: HorseSettledBehavior;
    dwellUntil: number;
    lookAt: Vector3 | null;
    phase: 'settled';
};

type MovingHorseState = {
    from: Vector3;
    movement: HorseMovement;
    phase: 'moving';
    startedAt: number;
    to: Vector3;
};

type HorseRuntimeState = MovingHorseState | SettledHorseState;

const horseGroundLift = 0.025;
const horseNavigationRadius = horseRoamRange + 2.5;
const horseObstacleClearanceCells = 1;
const horseTurnDamping = 5.2;
const horseLookAheadDistance = 0.18;
const horseRetreatAttentionSeconds = 0.55;
const horseRetreatCooldownSeconds = 4;
const horseWalkCycleDistance = 1.45;
const horseTrotCycleDistance = 1.82;
const fullTurn = Math.PI * 2;

function horizontalDistance(
    left: Pick<Vector3, 'x' | 'z'>,
    right: Pick<Vector3, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function normalizeAngle(angle: number) {
    return MathUtils.euclideanModulo(angle + Math.PI, fullTurn) - Math.PI;
}

function facePosition(group: Group, target: Vector3, delta: number) {
    const dx = target.x - group.position.x;
    const dz = target.z - group.position.z;
    if (Math.hypot(dx, dz) <= 0.001) return;
    const targetYaw = Math.atan2(dx, dz);
    const deltaYaw = normalizeAngle(targetYaw - group.rotation.y);
    group.rotation.y = normalizeAngle(
        group.rotation.y + MathUtils.damp(0, deltaYaw, horseTurnDamping, delta),
    );
}

function pathPositionAtDistance(path: CatPathPoint[], distance: number) {
    const first = path[0];
    if (!first) return new Vector3();
    let remaining = Math.max(0, distance);

    for (let index = 1; index < path.length; index++) {
        const from = path[index - 1];
        const to = path[index];
        if (!from || !to) continue;
        const segmentDistance = Math.hypot(to.x - from.x, to.z - from.z);
        if (remaining <= segmentDistance) {
            const progress =
                segmentDistance <= 0 ? 1 : remaining / segmentDistance;
            return new Vector3(
                MathUtils.lerp(from.x, to.x, progress),
                MathUtils.lerp(from.y, to.y, progress),
                MathUtils.lerp(from.z, to.z, progress),
            );
        }
        remaining -= segmentDistance;
    }

    const last = path.at(-1) ?? first;
    return new Vector3(last.x, last.y, last.z);
}

function cellKey(cell: AnimalMovementCell) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

function createSettledState({
    behavior,
    lookAt = null,
    now,
    random,
}: {
    behavior: HorseSettledBehavior;
    lookAt?: Vector3 | null;
    now: number;
    random: () => number;
}): SettledHorseState {
    return {
        behavior,
        dwellUntil: now + getHorseDwellSeconds(behavior, random),
        lookAt,
        phase: 'settled',
    };
}

function getHorseAnimation(runtime: HorseRuntimeState): HorseAnimationName {
    return runtime.phase === 'moving'
        ? getHorseMovementAnimation(runtime.movement.gait)
        : getHorseSettledAnimation(runtime.behavior);
}

function getAnimationTimeScale(
    action: AnimationAction,
    runtime: HorseRuntimeState | null,
) {
    if (runtime?.phase !== 'moving') return 1;
    const speed =
        runtime.movement.gait === 'trot' ? horseTrotSpeed : horseWalkSpeed;
    const cycleDistance =
        runtime.movement.gait === 'trot'
            ? horseTrotCycleDistance
            : horseWalkCycleDistance;
    return MathUtils.clamp(
        (speed * action.getClip().duration) / cycleDistance,
        0.55,
        1.6,
    );
}

function horseMaterialColor(
    materialName: string,
    meshName: string,
    appearance: ReturnType<typeof getHorseAppearanceVariantDefinition>,
) {
    return getHorseMaterialTint({ appearance, materialName, meshName });
}

function cloneHorseMaterial(
    material: Material,
    meshName: string,
    appearance: ReturnType<typeof getHorseAppearanceVariantDefinition>,
) {
    const clone = material.clone();
    const tint = horseMaterialColor(material.name, meshName, appearance);
    if (tint && clone instanceof MeshStandardMaterial) {
        clone.color.set(tint.color).multiplyScalar(tint.darken ?? 1);
        clone.metalness = 0;
        clone.roughness = Math.max(clone.roughness, 0.82);
    }
    return clone;
}

function prepareHorseMesh(
    mesh: Mesh,
    appearance: ReturnType<typeof getHorseAppearanceVariantDefinition>,
) {
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) =>
              cloneHorseMaterial(material, mesh.name, appearance),
          )
        : cloneHorseMaterial(mesh.material, mesh.name, appearance);
}

function chooseRoamMovement({
    blockedCells,
    candidates,
    from,
    random,
    surfaces,
}: {
    blockedCells: AnimalMovementCell[];
    candidates: CatPathPoint[];
    from: Vector3;
    random: () => number;
    surfaces: AnimalMovementSurface[];
}) {
    if (candidates.length === 0) return null;
    const startIndex = Math.floor(random() * candidates.length);
    for (let offset = 0; offset < candidates.length; offset++) {
        const candidate = candidates[(startIndex + offset) % candidates.length];
        if (!candidate || horizontalDistance(from, candidate) < 1.25) continue;
        const movement = resolveHorseMovement({
            blockedCells,
            from,
            reason: 'roam',
            surfaces,
            to: candidate,
        });
        if (movement) {
            return {
                from: from.clone(),
                movement,
                phase: 'moving',
                startedAt: 0,
                to: new Vector3(candidate.x, candidate.y, candidate.z),
            } satisfies MovingHorseState;
        }
    }
    return null;
}

function chooseRetreatMovement({
    avatar,
    blockedCells,
    candidates,
    from,
    surfaces,
}: {
    avatar: AnimalMovementCell;
    blockedCells: AnimalMovementCell[];
    candidates: CatPathPoint[];
    from: Vector3;
    surfaces: AnimalMovementSurface[];
}) {
    const remaining = [...candidates];
    while (remaining.length > 0) {
        const candidate = chooseHorseRetreatTarget({
            avatar,
            candidates: remaining,
            current: from,
        });
        if (!candidate) return null;
        const movement = resolveHorseMovement({
            blockedCells,
            from,
            reason: 'avatar-step-away',
            surfaces,
            to: candidate,
        });
        if (movement) {
            return {
                from: from.clone(),
                movement,
                phase: 'moving',
                startedAt: 0,
                to: new Vector3(candidate.x, candidate.y, candidate.z),
            } satisfies MovingHorseState;
        }
        remaining.splice(remaining.indexOf(candidate), 1);
    }
    return null;
}

export function Horse({
    block,
    rotation,
    stack,
    stacks,
    variant,
}: EntityInstanceProps) {
    const gltf = useGameGLTF('Horse');
    const { data: blockData } = useBlockData();
    const gameStateStore = useGameStateStore();
    const anchorHeight = useStackHeight(stack, block);
    const groupRef = useRef<Group>(null);
    const runtimeRef = useRef<HorseRuntimeState | null>(null);
    const randomRef = useRef(createHorseRandom(block.id));
    const closeAvatarSinceRef = useRef<number | null>(null);
    const retreatCooldownUntilRef = useRef(Number.NEGATIVE_INFINITY);
    const lastPresenceUpdateRef = useRef(0);
    const activeAnimationRef = useRef<HorseAnimationName>('Horse_Idle');
    const [activeAnimation, setActiveAnimation] =
        useState<HorseAnimationName>('Horse_Idle');
    const setAnimalPresenceEntry = useGameState(
        (state) => state.setAnimalPresenceEntry,
    );
    const removeAnimalPresenceEntry = useGameState(
        (state) => state.removeAnimalPresenceEntry,
    );
    const appearanceVariant = resolveHorseAppearanceVariant(variant, block.id);
    const appearance = getHorseAppearanceVariantDefinition(appearanceVariant);
    const homePlacement =
        block.name === 'HorseStable'
            ? getPersistentPetHomePlacement({
                  blockName: 'HorseStable',
                  rotation,
                  x: stack.position.x,
                  z: stack.position.z,
              })
            : null;

    const navigation = useMemo(() => {
        const surfaces = createAnimalMovementSurfaces({
            blockData,
            groundLift: horseGroundLift,
            stacks,
            swimDepth: 0,
        });
        const anchor = homePlacement?.center ?? {
            x: stack.position.x,
            z: stack.position.z,
        };
        const blockedCells = createHorseNavigationBlockedCells({
            blockedCells:
                block.name === 'HorseStable'
                    ? createPersistentPetHomeBlockedCells({
                          block,
                          blockData,
                          blockWater: true,
                          clearanceCells: horseObstacleClearanceCells,
                          stack,
                          stacks,
                      })
                    : createAnimalBlockedCells(stacks, {
                          blockData,
                          blockWater: true,
                          clearanceCells: horseObstacleClearanceCells,
                          ignoredBlockIds: [block.id],
                      }),
            center: anchor,
            radius: horseNavigationRadius,
            surfaces,
        });
        const blockedKeys = new Set(blockedCells.map(cellKey));
        const candidates = surfaces
            .filter(
                (surface) =>
                    surface.kind === 'ground' &&
                    !blockedKeys.has(cellKey(surface)) &&
                    Math.hypot(surface.x - anchor.x, surface.z - anchor.z) <=
                        horseRoamRange,
            )
            .map((surface) => ({
                x: surface.x,
                y: surface.y,
                z: surface.z,
            }));
        const homeAnchor = homePlacement?.doorway ?? anchor;
        const anchorSurface = getAnimalMovementSurfaceAt(homeAnchor, surfaces);
        const home = new Vector3(
            homeAnchor.x,
            anchorSurface?.kind === 'ground'
                ? Math.max(horseGroundLift, anchorSurface.y)
                : anchorHeight + horseGroundLift,
            homeAnchor.z,
        );
        return { blockedCells, candidates, home, surfaces };
    }, [
        anchorHeight,
        block,
        block.id,
        blockData,
        homePlacement?.center,
        homePlacement?.doorway,
        stack,
        stack.position.x,
        stack.position.z,
        stacks,
    ]);

    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        const { primaryCasterCount } = configureActorMeshShadows(
            scene,
            (mesh) => prepareHorseMesh(mesh, appearance),
        );
        return { primaryCasterCount, scene };
    }, [appearance, gltf.scene]);
    const { actions } = useAnimations(gltf.animations, model.scene);
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: `horse:${block.id}`,
        primaryCasterCount: model.primaryCasterCount,
        species: 'horse',
    });
    useSceneTimeInvalidation('fauna:horses', true, sceneFrameRates.ambient);
    const homeX = navigation.home.x;
    const homeY = navigation.home.y;
    const homeZ = navigation.home.z;

    useEffect(() => {
        const group = groupRef.current;
        runtimeRef.current = null;
        randomRef.current = createHorseRandom(block.id);
        closeAvatarSinceRef.current = null;
        if (group) {
            group.position.set(homeX, homeY, homeZ);
            group.rotation.y =
                homePlacement?.facingYaw ?? rotation * (Math.PI / 2);
        }
    }, [block.id, homePlacement?.facingYaw, homeX, homeY, homeZ, rotation]);

    useEffect(() => {
        const action = actions[activeAnimation];
        if (!action) return;
        const oneShot = activeAnimation === 'Horse_TailSwish';
        action.clampWhenFinished = oneShot;
        action.setLoop(oneShot ? LoopOnce : LoopRepeat, oneShot ? 1 : Infinity);
        action.timeScale = getAnimationTimeScale(action, runtimeRef.current);
        action.reset().fadeIn(0.24).play();
        return () => {
            action.fadeOut(0.24);
        };
    }, [actions, activeAnimation]);

    useEffect(
        () => () => removeAnimalPresenceEntry(`horse:${block.id}`),
        [block.id, removeAnimalPresenceEntry],
    );

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group) return;
        const now = clock.elapsedTime;
        const random = randomRef.current;
        const state = gameStateStore.getState();

        if (state.pickupBlock?.id === block.id) {
            runtimeRef.current = null;
            group.position.copy(navigation.home);
            return;
        }

        let runtime = runtimeRef.current;
        if (!runtime) {
            runtime = createSettledState({
                behavior: 'idle',
                now,
                random,
            });
            runtimeRef.current = runtime;
            group.position.copy(navigation.home);
        }

        const avatarPresence = state.gardenAvatarPresence;
        const hasFreshAvatar = isFreshGardenAvatarPresence(avatarPresence, now);
        const avatarPosition = hasFreshAvatar
            ? new Vector3(
                  avatarPresence.position.x,
                  avatarPresence.position.y,
                  avatarPresence.position.z,
              )
            : null;
        const avatarDistance = avatarPosition
            ? horizontalDistance(group.position, avatarPosition)
            : null;

        if (
            avatarPosition &&
            avatarDistance !== null &&
            avatarDistance <= horseAvatarPersonalSpaceDistance
        ) {
            closeAvatarSinceRef.current ??= now;
            const hasObservedAvatar =
                now - closeAvatarSinceRef.current >=
                horseRetreatAttentionSeconds;
            if (
                hasObservedAvatar &&
                now >= retreatCooldownUntilRef.current &&
                !(
                    runtime.phase === 'moving' &&
                    runtime.movement.reason === 'avatar-step-away'
                )
            ) {
                const retreat = chooseRetreatMovement({
                    avatar: avatarPosition,
                    blockedCells: navigation.blockedCells,
                    candidates: navigation.candidates,
                    from: group.position,
                    surfaces: navigation.surfaces,
                });
                if (retreat) {
                    retreat.startedAt = now;
                    runtime = retreat;
                    runtimeRef.current = runtime;
                    retreatCooldownUntilRef.current =
                        now + horseRetreatCooldownSeconds;
                }
            } else if (runtime.phase !== 'moving') {
                runtime = createSettledState({
                    behavior: 'attentive',
                    lookAt: avatarPosition,
                    now,
                    random,
                });
                runtimeRef.current = runtime;
            }
        } else {
            closeAvatarSinceRef.current = null;
            if (
                avatarPosition &&
                avatarDistance !== null &&
                avatarDistance <= horseAvatarAttentionDistance &&
                runtime.phase !== 'moving'
            ) {
                runtime = createSettledState({
                    behavior: 'attentive',
                    lookAt: avatarPosition,
                    now,
                    random,
                });
                runtimeRef.current = runtime;
            }
        }

        if (runtime.phase === 'moving') {
            const progress = MathUtils.clamp(
                (now - runtime.startedAt) / runtime.movement.duration,
                0,
                1,
            );
            const distance = runtime.movement.pathDistance * progress;
            const position = pathPositionAtDistance(
                runtime.movement.path,
                distance,
            );
            position.y = getAnimalMovementYAt(position, navigation.surfaces);
            group.position.copy(position);
            facePosition(
                group,
                pathPositionAtDistance(
                    runtime.movement.path,
                    Math.min(
                        runtime.movement.pathDistance,
                        distance + horseLookAheadDistance,
                    ),
                ),
                delta,
            );
            if (progress >= 1) {
                group.position.copy(runtime.to);
                runtime = createSettledState({
                    behavior: pickHorseSettledBehavior({
                        avatarDistance,
                        random,
                    }),
                    lookAt: avatarPosition,
                    now,
                    random,
                });
                runtimeRef.current = runtime;
            }
        } else {
            if (runtime.lookAt) facePosition(group, runtime.lookAt, delta);
            const avatarHoldingAttention =
                avatarDistance !== null &&
                avatarDistance <= horseAvatarAttentionDistance;
            if (!avatarHoldingAttention && now >= runtime.dwellUntil) {
                const shouldRoam = random() < 0.38;
                const roam = shouldRoam
                    ? chooseRoamMovement({
                          blockedCells: navigation.blockedCells,
                          candidates: navigation.candidates,
                          from: group.position,
                          random,
                          surfaces: navigation.surfaces,
                      })
                    : null;
                if (roam) {
                    roam.startedAt = now;
                    runtime = roam;
                } else {
                    runtime = createSettledState({
                        behavior: pickHorseSettledBehavior({
                            avatarDistance: null,
                            random,
                        }),
                        now,
                        random,
                    });
                }
                runtimeRef.current = runtime;
            }
        }

        const nextAnimation = getHorseAnimation(runtime);
        if (nextAnimation !== activeAnimationRef.current) {
            activeAnimationRef.current = nextAnimation;
            setActiveAnimation(nextAnimation);
        }

        updateActorGroundingShadow?.({
            actorY: group.position.y,
            receiverY: getAnimalMovementYAt(
                group.position,
                navigation.surfaces,
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
                behavior:
                    runtime.phase === 'moving'
                        ? runtime.movement.gait
                        : runtime.behavior,
                id: `horse:${block.id}`,
                position: {
                    x: group.position.x,
                    y: group.position.y,
                    z: group.position.z,
                },
                species: 'Horse',
                updatedAt: now,
            });
        }
    });

    return (
        <group ref={groupRef} name={`Horse:${block.id}`}>
            <primitive object={model.scene} />
        </group>
    );
}
