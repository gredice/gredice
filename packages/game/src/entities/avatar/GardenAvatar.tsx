import { Html, PerspectiveCamera } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useEffect, useMemo, useRef } from 'react';
import {
    type Group,
    MathUtils,
    type Object3D,
    Quaternion,
    PerspectiveCamera as ThreePerspectiveCamera,
    Vector3,
} from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import { type GardenAvatarView, useGameState } from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import { configureActorMeshShadows } from '../animals/actorMeshShadows';
import {
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
} from '../animals/animalMovementTerrain';
import {
    findGardenAvatarRoute,
    findGardenAvatarSpawnPoint,
    type GardenAvatarCollisionWorld,
    type GardenAvatarPoint,
    getGardenAvatarGroundY,
    resolveGardenAvatarHorizontalMovement,
} from './gardenAvatarMovement';

const avatarModelScale = 0.72;
const avatarEyeHeight = 1.42;
const avatarWalkSpeed = 1.75;
const avatarRunSpeed = 2.45;
const avatarRoamSpeed = 0.55;
const avatarAcceleration = 13;
const avatarDeceleration = 10;
const avatarGravity = 11.8;
const avatarJumpVelocity = 4.35;
const avatarTurnDamping = 12;
const avatarCameraDamping = 10;
const avatarCameraTransitionSeconds = 0.85;
const pointerLookSensitivity = 0.0023;
const touchLookSensitivity = 0.006;

type AvatarRig = {
    armLeft: Object3D | undefined;
    armRight: Object3D | undefined;
    body: Object3D | undefined;
    head: Object3D | undefined;
    legLeft: Object3D | undefined;
    legRight: Object3D | undefined;
};

type AvatarRoamState = {
    route: GardenAvatarPoint[];
    waitUntil: number;
};

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

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    return (
        target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
    );
}

function dampAngle(
    current: number,
    target: number,
    damping: number,
    delta: number,
) {
    const difference = Math.atan2(
        Math.sin(target - current),
        Math.cos(target - current),
    );
    return current + difference * (1 - Math.exp(-damping * delta));
}

function prepareAvatarModel(root: Object3D) {
    const { primaryCasterCount } = configureActorMeshShadows(root, (mesh) => {
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
    });

    return {
        primaryCasterCount,
        rig: {
            armLeft: root.getObjectByName('FarmerAvatar_ArmPivot_L'),
            armRight: root.getObjectByName('FarmerAvatar_ArmPivot_R'),
            body: root.getObjectByName('FarmerAvatar_BodyPivot'),
            head: root.getObjectByName('FarmerAvatar_HeadPivot'),
            legLeft: root.getObjectByName('FarmerAvatar_LegPivot_L'),
            legRight: root.getObjectByName('FarmerAvatar_LegPivot_R'),
        } satisfies AvatarRig,
    };
}

function animateAvatarRig({
    delta,
    grounded,
    movingSpeed,
    now,
    rig,
}: {
    delta: number;
    grounded: boolean;
    movingSpeed: number;
    now: number;
    rig: AvatarRig;
}) {
    const walkAmount = MathUtils.clamp(movingSpeed / avatarWalkSpeed, 0, 1);
    const walkPhase = now * (7.2 + walkAmount * 2.4);
    const legSwing = grounded ? Math.sin(walkPhase) * 0.58 * walkAmount : -0.2;
    const armSwing = grounded ? Math.sin(walkPhase) * 0.46 * walkAmount : -0.48;
    const poseDamping = 1 - Math.exp(-12 * delta);

    if (rig.legLeft) {
        rig.legLeft.rotation.x = MathUtils.lerp(
            rig.legLeft.rotation.x,
            legSwing,
            poseDamping,
        );
    }
    if (rig.legRight) {
        rig.legRight.rotation.x = MathUtils.lerp(
            rig.legRight.rotation.x,
            -legSwing,
            poseDamping,
        );
    }
    if (rig.armLeft) {
        rig.armLeft.rotation.x = MathUtils.lerp(
            rig.armLeft.rotation.x,
            -armSwing,
            poseDamping,
        );
        rig.armLeft.rotation.z = MathUtils.lerp(
            rig.armLeft.rotation.z,
            grounded ? 0.03 : 0.22,
            poseDamping,
        );
    }
    if (rig.armRight) {
        rig.armRight.rotation.x = MathUtils.lerp(
            rig.armRight.rotation.x,
            armSwing,
            poseDamping,
        );
        rig.armRight.rotation.z = MathUtils.lerp(
            rig.armRight.rotation.z,
            grounded ? -0.03 : -0.22,
            poseDamping,
        );
    }
    if (rig.body) {
        rig.body.position.y = MathUtils.lerp(
            rig.body.position.y,
            grounded
                ? Math.abs(Math.sin(walkPhase)) * 0.018 * walkAmount +
                      Math.sin(now * 1.7) * 0.004
                : 0.035,
            poseDamping,
        );
        rig.body.rotation.z = MathUtils.lerp(
            rig.body.rotation.z,
            grounded ? Math.sin(walkPhase) * 0.018 * walkAmount : 0,
            poseDamping,
        );
    }
    if (rig.head) {
        rig.head.rotation.z = MathUtils.lerp(
            rig.head.rotation.z,
            grounded ? -Math.sin(walkPhase) * 0.012 * walkAmount : 0,
            poseDamping,
        );
    }
}

function createRoamTargetCandidates(world: GardenAvatarCollisionWorld) {
    const blocked = new Set(
        world.blockedCells.map(
            (cell) => `${Math.round(cell.x)}:${Math.round(cell.z)}`,
        ),
    );
    return world.surfaces
        .filter(
            (surface) =>
                surface.kind === 'ground' &&
                !blocked.has(
                    `${Math.round(surface.x)}:${Math.round(surface.z)}`,
                ),
        )
        .map((surface) => ({ x: surface.x, y: surface.y, z: surface.z }));
}

function easeInOutCubic(value: number) {
    return value < 0.5
        ? 4 * value * value * value
        : 1 - (-2 * value + 2) ** 3 / 2;
}

function GardenAvatarCamera({
    actorRef,
    pitchRef,
    view,
    yawRef,
}: {
    actorRef: RefObject<Group | null>;
    pitchRef: RefObject<number>;
    view: Exclude<GardenAvatarView, 'overview'>;
    yawRef: RefObject<number>;
}) {
    const overviewCamera = useThree((state) => state.camera);
    const cameraRef = useRef<ThreePerspectiveCamera>(null);
    const entryPositionRef = useRef(overviewCamera.position.clone());
    const entryQuaternionRef = useRef(overviewCamera.quaternion.clone());
    const transitionElapsedRef = useRef(0);
    const previousViewRef = useRef(view);
    const desiredPositionRef = useRef(new Vector3());
    const lookTargetRef = useRef(new Vector3());
    const lookDirectionRef = useRef(new Vector3());
    const desiredQuaternionRef = useRef(new Quaternion());
    const rotationHelperRef = useRef(new ThreePerspectiveCamera());

    useFrame((_, frameDelta) => {
        const actor = actorRef.current;
        const camera = cameraRef.current;
        if (!actor || !camera) {
            return;
        }

        const delta = Math.min(frameDelta, 0.05);
        if (previousViewRef.current !== view) {
            previousViewRef.current = view;
            transitionElapsedRef.current = 0;
            entryPositionRef.current.copy(camera.position);
            entryQuaternionRef.current.copy(camera.quaternion);
        }

        const yaw = yawRef.current;
        const pitch = pitchRef.current;
        const horizontalForward = lookDirectionRef.current.set(
            Math.sin(yaw),
            0,
            -Math.cos(yaw),
        );
        const lookDirection = new Vector3(
            horizontalForward.x * Math.cos(pitch),
            Math.sin(pitch),
            horizontalForward.z * Math.cos(pitch),
        );

        if (view === 'first-person') {
            desiredPositionRef.current.set(
                actor.position.x,
                actor.position.y + avatarEyeHeight,
                actor.position.z,
            );
            lookTargetRef.current
                .copy(desiredPositionRef.current)
                .addScaledVector(lookDirection, 4);
        } else {
            const followDistance = 2.25;
            desiredPositionRef.current
                .set(
                    actor.position.x,
                    actor.position.y + 1.18,
                    actor.position.z,
                )
                .addScaledVector(horizontalForward, -followDistance);
            desiredPositionRef.current.y += 0.72 + pitch * 0.65;
            lookTargetRef.current
                .set(
                    actor.position.x,
                    actor.position.y + 1.05,
                    actor.position.z,
                )
                .addScaledVector(lookDirection, 1.4);
        }

        const rotationHelper = rotationHelperRef.current;
        rotationHelper.position.copy(desiredPositionRef.current);
        rotationHelper.lookAt(lookTargetRef.current);
        desiredQuaternionRef.current.copy(rotationHelper.quaternion);

        transitionElapsedRef.current += delta;
        const transitionProgress = MathUtils.clamp(
            transitionElapsedRef.current / avatarCameraTransitionSeconds,
            0,
            1,
        );
        if (transitionProgress < 1) {
            const eased = easeInOutCubic(transitionProgress);
            camera.position.lerpVectors(
                entryPositionRef.current,
                desiredPositionRef.current,
                eased,
            );
            camera.quaternion.slerpQuaternions(
                entryQuaternionRef.current,
                desiredQuaternionRef.current,
                eased,
            );
        } else {
            const damping = 1 - Math.exp(-avatarCameraDamping * delta);
            camera.position.lerp(desiredPositionRef.current, damping);
            camera.quaternion.slerp(desiredQuaternionRef.current, damping);
        }
        camera.updateMatrixWorld();
    });

    return (
        <PerspectiveCamera
            ref={cameraRef}
            makeDefault
            fov={55}
            near={0.05}
            far={10_000}
            position={entryPositionRef.current}
        />
    );
}

export function GardenAvatar({ stacks }: { stacks: Stack[] | undefined }) {
    const gltf = useGameGLTF('FarmerAvatar');
    const { data: blockData } = useBlockData();
    const view = useGameState((state) => state.gardenAvatarView);
    const setView = useGameState((state) => state.setGardenAvatarView);
    const touchMoveInput = useGameState((state) => state.gardenAvatarMoveInput);
    const jumpRequest = useGameState((state) => state.gardenAvatarJumpRequest);
    const { gl } = useThree();
    const actorRef = useRef<Group>(null);
    const visualRef = useRef<Group>(null);
    const yawRef = useRef(0);
    const pitchRef = useRef(-0.08);
    const velocityRef = useRef(new Vector3());
    const verticalVelocityRef = useRef(0);
    const groundedRef = useRef(true);
    const groundYRef = useRef(0);
    const keyboardRef = useRef(new Set<string>());
    const jumpQueuedRef = useRef(false);
    const previousJumpRequestRef = useRef(jumpRequest);
    const previousViewRef = useRef(view);
    const randomRef = useRef(createRandom(0x47524544));
    const roamRef = useRef<AvatarRoamState>({ route: [], waitUntil: 4 });
    const distanceWalkedRef = useRef(0);
    const initializedRef = useRef(false);
    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        return { ...prepareAvatarModel(scene), scene };
    }, [gltf.scene]);
    const world = useMemo(
        () => ({
            blockedCells: createAnimalBlockedCells(stacks),
            surfaces: createAnimalMovementSurfaces({
                blockData,
                groundLift: 0,
                stacks,
                swimDepth: 0,
            }),
        }),
        [blockData, stacks],
    );
    const roamCandidates = useMemo(
        () => createRoamTargetCandidates(world),
        [world],
    );
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: 'garden-avatar',
        primaryCasterCount: model.primaryCasterCount,
        species: 'avatar',
    });
    useSceneTimeInvalidation(true, sceneFrameRates.interactive);

    useEffect(
        () => () => {
            gl.domElement.style.cursor = 'auto';
        },
        [gl.domElement],
    );

    useEffect(() => {
        const actor = actorRef.current;
        if (!actor) {
            return;
        }
        const spawn = findGardenAvatarSpawnPoint(world);
        if (!spawn) {
            actor.visible = false;
            return;
        }
        actor.visible = true;
        const currentGroundY = getGardenAvatarGroundY({
            currentGroundY: groundYRef.current,
            position: actor.position,
            world,
        });
        if (!initializedRef.current || currentGroundY === null) {
            actor.position.set(spawn.x, spawn.y, spawn.z);
            groundYRef.current = spawn.y;
            initializedRef.current = true;
        } else {
            groundYRef.current = currentGroundY;
        }
    }, [world]);

    useEffect(() => {
        if (jumpRequest !== previousJumpRequestRef.current) {
            previousJumpRequestRef.current = jumpRequest;
            jumpQueuedRef.current = true;
        }
    }, [jumpRequest]);

    useEffect(() => {
        if (view === 'overview') {
            keyboardRef.current.clear();
            velocityRef.current.set(0, 0, 0);
            verticalVelocityRef.current = 0;
            if (document.pointerLockElement === gl.domElement) {
                document.exitPointerLock();
            }
            return;
        }

        let dragPointerId: number | null = null;
        let lastPointerX = 0;
        let lastPointerY = 0;

        const updateLook = (
            movementX: number,
            movementY: number,
            scale: number,
        ) => {
            yawRef.current -= movementX * scale;
            pitchRef.current = MathUtils.clamp(
                pitchRef.current - movementY * scale,
                -0.72,
                0.55,
            );
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableTarget(event.target)) {
                return;
            }
            if (event.code === 'Space' || event.code.startsWith('Arrow')) {
                event.preventDefault();
            }
            if (event.code === 'Escape') {
                setView('overview');
                return;
            }
            if (event.code === 'Space' && !event.repeat) {
                jumpQueuedRef.current = true;
            }
            keyboardRef.current.add(event.code);
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            keyboardRef.current.delete(event.code);
        };
        const clearKeyboardInput = () => {
            keyboardRef.current.clear();
        };
        const handleVisibilityChange = () => {
            if (document.hidden) {
                clearKeyboardInput();
            }
        };
        const handleMouseMove = (event: MouseEvent) => {
            if (document.pointerLockElement === gl.domElement) {
                updateLook(
                    event.movementX,
                    event.movementY,
                    pointerLookSensitivity,
                );
            }
        };
        const handlePointerDown = (event: PointerEvent) => {
            if (event.pointerType === 'mouse') {
                if (
                    event.button === 0 &&
                    document.pointerLockElement !== gl.domElement
                ) {
                    void gl.domElement.requestPointerLock();
                }
                return;
            }
            dragPointerId = event.pointerId;
            lastPointerX = event.clientX;
            lastPointerY = event.clientY;
        };
        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerId !== dragPointerId) {
                return;
            }
            updateLook(
                event.clientX - lastPointerX,
                event.clientY - lastPointerY,
                touchLookSensitivity,
            );
            lastPointerX = event.clientX;
            lastPointerY = event.clientY;
        };
        const handlePointerEnd = (event: PointerEvent) => {
            if (event.pointerId === dragPointerId) {
                dragPointerId = null;
            }
        };

        window.addEventListener('keydown', handleKeyDown, { passive: false });
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', clearKeyboardInput);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('mousemove', handleMouseMove);
        gl.domElement.addEventListener('pointerdown', handlePointerDown);
        gl.domElement.addEventListener('pointermove', handlePointerMove);
        gl.domElement.addEventListener('pointerup', handlePointerEnd);
        gl.domElement.addEventListener('pointercancel', handlePointerEnd);
        return () => {
            clearKeyboardInput();
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', clearKeyboardInput);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            document.removeEventListener('mousemove', handleMouseMove);
            gl.domElement.removeEventListener('pointerdown', handlePointerDown);
            gl.domElement.removeEventListener('pointermove', handlePointerMove);
            gl.domElement.removeEventListener('pointerup', handlePointerEnd);
            gl.domElement.removeEventListener(
                'pointercancel',
                handlePointerEnd,
            );
        };
    }, [gl.domElement, setView, view]);

    function activateAvatarView() {
        const actor = actorRef.current;
        if (!actor || view !== 'overview') {
            return;
        }
        yawRef.current = actor.rotation.y;
        pitchRef.current = -0.08;
        roamRef.current.route = [];
        setView('third-person');
    }

    function enterAvatarView(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        activateAvatarView();
    }

    function stopAvatarPointer(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
    }

    function showAvatarPointer(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        if (view === 'overview') {
            gl.domElement.style.cursor = 'pointer';
        }
    }

    function hideAvatarPointer() {
        gl.domElement.style.cursor = 'auto';
    }

    useFrame(({ clock }, frameDelta) => {
        const actor = actorRef.current;
        if (!actor?.visible) {
            return;
        }
        const delta = Math.min(frameDelta, 0.05);
        const now = clock.elapsedTime;
        let movingSpeed = 0;

        if (previousViewRef.current !== view) {
            if (previousViewRef.current === 'overview') {
                yawRef.current = actor.rotation.y;
            }
            previousViewRef.current = view;
        }

        if (view === 'overview') {
            const roam = roamRef.current;
            if (roam.route.length === 0 && now >= roam.waitUntil) {
                const random = randomRef.current;
                const target =
                    roamCandidates[
                        Math.floor(random() * roamCandidates.length)
                    ];
                if (target) {
                    roam.route = findGardenAvatarRoute({
                        from: {
                            x: actor.position.x,
                            y: groundYRef.current,
                            z: actor.position.z,
                        },
                        to: target,
                        world,
                    }).slice(1);
                }
                roam.waitUntil = now + 3.5 + random() * 4;
            }

            const target = roam.route[0];
            if (target) {
                const dx = target.x - actor.position.x;
                const dz = target.z - actor.position.z;
                const distance = Math.hypot(dx, dz);
                if (distance <= 0.06) {
                    roam.route.shift();
                    if (roam.route.length === 0) {
                        roam.waitUntil = now + 2.5 + randomRef.current() * 4;
                    }
                } else {
                    const travel = Math.min(distance, avatarRoamSpeed * delta);
                    const movement = resolveGardenAvatarHorizontalMovement({
                        deltaX: (dx / distance) * travel,
                        deltaZ: (dz / distance) * travel,
                        position: {
                            x: actor.position.x,
                            y: groundYRef.current,
                            z: actor.position.z,
                        },
                        world,
                    });
                    const moved = Math.hypot(
                        movement.position.x - actor.position.x,
                        movement.position.z - actor.position.z,
                    );
                    actor.position.set(
                        movement.position.x,
                        movement.position.y,
                        movement.position.z,
                    );
                    groundYRef.current = movement.position.y;
                    actor.rotation.y = dampAngle(
                        actor.rotation.y,
                        Math.atan2(dx, -dz),
                        avatarTurnDamping,
                        delta,
                    );
                    movingSpeed = moved / Math.max(delta, 0.001);
                    distanceWalkedRef.current += moved;
                    if (movement.collided && moved < 0.002) {
                        roam.route = [];
                        roam.waitUntil = now + 1.5;
                    }
                }
            }
            actor.position.y = groundYRef.current;
            groundedRef.current = true;
        } else {
            const keys = keyboardRef.current;
            const keyboardForward =
                (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
                (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
            const keyboardRight =
                (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
                (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
            const inputForward = MathUtils.clamp(
                keyboardForward + touchMoveInput.forward,
                -1,
                1,
            );
            const inputRight = MathUtils.clamp(
                keyboardRight + touchMoveInput.right,
                -1,
                1,
            );
            const inputLength = Math.hypot(inputForward, inputRight);
            const targetSpeed = keys.has('ShiftLeft')
                ? avatarRunSpeed
                : avatarWalkSpeed;
            const forwardX = Math.sin(yawRef.current);
            const forwardZ = -Math.cos(yawRef.current);
            const rightX = Math.cos(yawRef.current);
            const rightZ = Math.sin(yawRef.current);
            const normalizedForward =
                inputLength > 1 ? inputForward / inputLength : inputForward;
            const normalizedRight =
                inputLength > 1 ? inputRight / inputLength : inputRight;
            const desiredX =
                (forwardX * normalizedForward + rightX * normalizedRight) *
                targetSpeed;
            const desiredZ =
                (forwardZ * normalizedForward + rightZ * normalizedRight) *
                targetSpeed;
            const velocity = velocityRef.current;
            const damping =
                inputLength > 0 ? avatarAcceleration : avatarDeceleration;
            velocity.x = MathUtils.damp(velocity.x, desiredX, damping, delta);
            velocity.z = MathUtils.damp(velocity.z, desiredZ, damping, delta);

            const movement = resolveGardenAvatarHorizontalMovement({
                deltaX: velocity.x * delta,
                deltaZ: velocity.z * delta,
                position: {
                    x: actor.position.x,
                    y: groundYRef.current,
                    z: actor.position.z,
                },
                world,
            });
            const movedX = movement.position.x - actor.position.x;
            const movedZ = movement.position.z - actor.position.z;
            const moved = Math.hypot(movedX, movedZ);
            actor.position.x = movement.position.x;
            actor.position.z = movement.position.z;
            groundYRef.current = movement.position.y;
            if (movement.collided) {
                if (Math.abs(movedX) < Math.abs(velocity.x * delta) * 0.2) {
                    velocity.x = 0;
                }
                if (Math.abs(movedZ) < Math.abs(velocity.z * delta) * 0.2) {
                    velocity.z = 0;
                }
            }
            movingSpeed = moved / Math.max(delta, 0.001);
            distanceWalkedRef.current += moved;
            if (movingSpeed > 0.05) {
                actor.rotation.y = dampAngle(
                    actor.rotation.y,
                    Math.atan2(velocity.x, -velocity.z),
                    avatarTurnDamping,
                    delta,
                );
            }

            if (jumpQueuedRef.current && groundedRef.current) {
                verticalVelocityRef.current = avatarJumpVelocity;
                groundedRef.current = false;
            }
            jumpQueuedRef.current = false;
            verticalVelocityRef.current -= avatarGravity * delta;
            actor.position.y += verticalVelocityRef.current * delta;
            if (actor.position.y <= groundYRef.current) {
                actor.position.y = groundYRef.current;
                verticalVelocityRef.current = 0;
                groundedRef.current = true;
            }
        }

        animateAvatarRig({
            delta,
            grounded: groundedRef.current,
            movingSpeed,
            now: distanceWalkedRef.current,
            rig: model.rig,
        });
        if (visualRef.current) {
            visualRef.current.visible = view !== 'first-person';
        }
        updateActorGroundingShadow?.({
            actorY: actor.position.y,
            receiverY: groundYRef.current,
            visible: actor.visible && view !== 'first-person',
            x: actor.position.x,
            yaw: actor.rotation.y,
            z: actor.position.z,
        });
    });

    return (
        <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js actor enters the playable camera mode. */}
            <group
                ref={actorRef}
                onPointerDown={stopAvatarPointer}
                onClick={enterAvatarView}
                onPointerOver={showAvatarPointer}
                onPointerOut={hideAvatarPointer}
            >
                <mesh
                    name="Interaction:GardenAvatar"
                    position={[0, 0.7, 0]}
                    scale={[0.9, 1.55, 0.9]}
                >
                    <boxGeometry />
                    <meshBasicMaterial
                        colorWrite={false}
                        depthWrite={false}
                        transparent
                        opacity={0}
                    />
                </mesh>
                <group ref={visualRef} scale={avatarModelScale}>
                    <primitive object={model.scene} />
                </group>
                {view === 'overview' ? (
                    <Html center position={[0, 1.68, 0]} zIndexRange={[30, 20]}>
                        <button
                            type="button"
                            className="whitespace-nowrap rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-xs font-medium shadow-md backdrop-blur-sm transition-transform hover:scale-105 hover:bg-muted"
                            onClick={(event) => {
                                event.stopPropagation();
                                activateAvatarView();
                            }}
                        >
                            Prošetaj vrtom
                        </button>
                    </Html>
                ) : null}
            </group>
            {view !== 'overview' ? (
                <GardenAvatarCamera
                    actorRef={actorRef}
                    pitchRef={pitchRef}
                    view={view}
                    yawRef={yawRef}
                />
            ) : null}
        </>
    );
}
