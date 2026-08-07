import { Html, PerspectiveCamera } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
    type RefObject,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import {
    type Group,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
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
import { getGardenAvatarPerspectiveEntryPosition } from './gardenAvatarCamera';
import {
    createGardenAvatarCollisionWorld,
    findGardenAvatarRoute,
    findGardenAvatarSpawnPoint,
    type GardenAvatarCollisionWorld,
    type GardenAvatarPoint,
    gardenAvatarCrouchingCollisionHeight,
    gardenAvatarMaxJumpClimbHeight,
    gardenAvatarMaxStepHeight,
    gardenAvatarStandingCollisionHeight,
    getGardenAvatarCeilingY,
    getGardenAvatarGroundY,
    getGardenAvatarNextJumpCount,
    getGardenAvatarRoamBlockedCells,
    getGardenAvatarSurfaceY,
    resolveGardenAvatarHorizontalMovement,
} from './gardenAvatarMovement';
import type { GardenAvatarPresenceState } from './gardenVisitorPresence';

export const avatarModelScale = 0.697;
const avatarEyeHeight = 1.2;
const avatarCrouchEyeHeight = 0.9;
const avatarWalkSpeed = 2.15;
const avatarRunSpeed = 4.68;
const avatarCrouchSpeed = 0.63;
const avatarRoamSpeed = 0.55;
const avatarAcceleration = 28;
const avatarDeceleration = 22;
const avatarGravity = 11.8;
const avatarJumpVelocity = 4.35;
const avatarTurnDamping = 26;
const avatarGroundDamping = 20;
const avatarCameraDamping = 28;
const avatarCameraTransitionSeconds = 0.58;
const avatarThirdPersonCameraGroundClearance = 0.12;
const avatarPitchLimit = Math.PI / 2;
const avatarPerspectiveFov = 55;
const avatarPerspectiveZoomFov = 34;
const avatarZoomDamping = 9;
const avatarHeadPitchLimit = 0.82;
const avatarCrouchRigDrop = 0.34;
const avatarCrouchLowerLegLength = 0.41;
const pointerLookSensitivity = 0.0023;
const touchLookSensitivity = 0.006;

type AvatarRig = {
    armLeft: Object3D | undefined;
    armRight: Object3D | undefined;
    body: Object3D | undefined;
    elbowLeft: Object3D | undefined;
    elbowRight: Object3D | undefined;
    head: Object3D | undefined;
    kneeLeft: Object3D | undefined;
    kneeRight: Object3D | undefined;
    legLeft: Object3D | undefined;
    legRight: Object3D | undefined;
    restY: {
        armLeft: number;
        armRight: number;
        body: number;
        head: number;
        legLeft: number;
        legRight: number;
    };
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

function hashAvatarSeed(value: string) {
    let hash = 2_166_136_261;
    for (const character of value) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
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

export function dampGardenAvatarAngle(
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

export function prepareGardenAvatarModel(root: Object3D) {
    const meshes: Mesh[] = [];
    const materials = new Map<Mesh, Mesh['material']>();
    root.traverse((object) => {
        if (!(object instanceof Mesh)) {
            return;
        }
        object.castShadow = false;
        object.receiveShadow = true;
        object.frustumCulled = false;
        meshes.push(object);
        materials.set(object, object.material);
    });

    const armLeft = root.getObjectByName('FarmerAvatar_ArmPivot_L');
    const armRight = root.getObjectByName('FarmerAvatar_ArmPivot_R');
    const body = root.getObjectByName('FarmerAvatar_BodyPivot');
    const head = root.getObjectByName('FarmerAvatar_HeadPivot');
    const legLeft = root.getObjectByName('FarmerAvatar_LegPivot_L');
    const legRight = root.getObjectByName('FarmerAvatar_LegPivot_R');

    return {
        meshes,
        materials,
        primaryCasterCount: meshes.length,
        shadowOnlyMaterial: new MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
        }),
        rig: {
            armLeft,
            armRight,
            body,
            elbowLeft: root.getObjectByName('FarmerAvatar_ElbowPivot_L'),
            elbowRight: root.getObjectByName('FarmerAvatar_ElbowPivot_R'),
            head,
            kneeLeft: root.getObjectByName('FarmerAvatar_KneePivot_L'),
            kneeRight: root.getObjectByName('FarmerAvatar_KneePivot_R'),
            legLeft,
            legRight,
            restY: {
                armLeft: armLeft?.position.y ?? 0,
                armRight: armRight?.position.y ?? 0,
                body: body?.position.y ?? 0,
                head: head?.position.y ?? 0,
                legLeft: legLeft?.position.y ?? 0,
                legRight: legRight?.position.y ?? 0,
            },
        } satisfies AvatarRig,
    };
}

export function animateGardenAvatarRig({
    crouchAmount,
    delta,
    distanceWalked,
    grounded,
    headPitch,
    walkAmount,
    rig,
}: {
    crouchAmount: number;
    delta: number;
    distanceWalked: number;
    grounded: boolean;
    headPitch: number;
    walkAmount: number;
    rig: AvatarRig;
}) {
    const walkPhase = (distanceWalked / 0.82) * Math.PI * 2;
    const phaseSine = Math.sin(walkPhase);
    const legSwing = grounded ? phaseSine * 0.44 * walkAmount : -0.2;
    const armSwing = grounded ? phaseSine * 0.34 * walkAmount : -0.48;
    const leftKneeBend = grounded
        ? Math.max(0, -phaseSine) * 0.38 * walkAmount + crouchAmount * 0.82
        : 0.42;
    const rightKneeBend = grounded
        ? Math.max(0, phaseSine) * 0.38 * walkAmount + crouchAmount * 0.82
        : 0.42;
    const poseDamping = 1 - Math.exp(-12 * delta);
    const crouchLegDrop =
        avatarCrouchLowerLegLength * (1 - Math.cos(crouchAmount * 0.82));

    if (rig.legLeft) {
        rig.legLeft.position.y = MathUtils.lerp(
            rig.legLeft.position.y,
            rig.restY.legLeft - crouchLegDrop,
            poseDamping,
        );
        rig.legLeft.rotation.x = MathUtils.lerp(
            rig.legLeft.rotation.x,
            legSwing,
            poseDamping,
        );
    }
    if (rig.legRight) {
        rig.legRight.position.y = MathUtils.lerp(
            rig.legRight.position.y,
            rig.restY.legRight - crouchLegDrop,
            poseDamping,
        );
        rig.legRight.rotation.x = MathUtils.lerp(
            rig.legRight.rotation.x,
            -legSwing,
            poseDamping,
        );
    }
    if (rig.armLeft) {
        rig.armLeft.position.y = MathUtils.lerp(
            rig.armLeft.position.y,
            rig.restY.armLeft - crouchAmount * avatarCrouchRigDrop,
            poseDamping,
        );
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
        rig.armRight.position.y = MathUtils.lerp(
            rig.armRight.position.y,
            rig.restY.armRight - crouchAmount * avatarCrouchRigDrop,
            poseDamping,
        );
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
    if (rig.elbowLeft) {
        rig.elbowLeft.rotation.x = MathUtils.lerp(
            rig.elbowLeft.rotation.x,
            grounded ? -0.12 - leftKneeBend * 0.16 : -0.5,
            poseDamping,
        );
    }
    if (rig.elbowRight) {
        rig.elbowRight.rotation.x = MathUtils.lerp(
            rig.elbowRight.rotation.x,
            grounded ? -0.12 - rightKneeBend * 0.16 : -0.5,
            poseDamping,
        );
    }
    if (rig.kneeLeft) {
        rig.kneeLeft.rotation.x = MathUtils.lerp(
            rig.kneeLeft.rotation.x,
            leftKneeBend,
            poseDamping,
        );
    }
    if (rig.kneeRight) {
        rig.kneeRight.rotation.x = MathUtils.lerp(
            rig.kneeRight.rotation.x,
            rightKneeBend,
            poseDamping,
        );
    }
    if (rig.body) {
        rig.body.position.y = MathUtils.lerp(
            rig.body.position.y,
            rig.restY.body +
                (grounded
                    ? Math.abs(phaseSine) * 0.015 * walkAmount -
                      crouchAmount * avatarCrouchRigDrop
                    : 0.035),
            poseDamping,
        );
        rig.body.rotation.z = MathUtils.lerp(
            rig.body.rotation.z,
            grounded ? Math.sin(walkPhase) * 0.018 * walkAmount : 0,
            poseDamping,
        );
    }
    if (rig.head) {
        rig.head.position.y = MathUtils.lerp(
            rig.head.position.y,
            rig.restY.head - crouchAmount * avatarCrouchRigDrop,
            poseDamping,
        );
        rig.head.rotation.x = MathUtils.lerp(
            rig.head.rotation.x,
            MathUtils.clamp(
                headPitch,
                -avatarHeadPitchLimit,
                avatarHeadPitchLimit,
            ),
            poseDamping,
        );
        rig.head.rotation.z = MathUtils.lerp(
            rig.head.rotation.z,
            grounded ? -Math.sin(walkPhase) * 0.012 * walkAmount : 0,
            poseDamping,
        );
    }
}

function createRoamTargetCandidates(world: GardenAvatarCollisionWorld) {
    const blocked = new Set(
        getGardenAvatarRoamBlockedCells(world).map(
            (cell) => `${Math.round(cell.x)}:${Math.round(cell.z)}`,
        ),
    );
    return world.surfaces
        .filter(
            (surface) =>
                surface.kind === 'ground' &&
                surface.roamable !== false &&
                !blocked.has(
                    `${Math.round(surface.x)}:${Math.round(surface.z)}`,
                ),
        )
        .map((surface) => ({
            x: surface.x,
            y: getGardenAvatarSurfaceY(surface, surface),
            z: surface.z,
        }));
}

function easeInOutCubic(value: number) {
    return value < 0.5
        ? 4 * value * value * value
        : 1 - (-2 * value + 2) ** 3 / 2;
}

type AvatarCameraEntryPose = {
    position: Vector3;
    quaternion: Quaternion;
};

function GardenAvatarCamera({
    actorRef,
    crouchAmountRef,
    entryPose,
    groundYRef,
    pitchRef,
    view,
    yawRef,
    zoomingRef,
}: {
    actorRef: RefObject<Group | null>;
    crouchAmountRef: RefObject<number>;
    entryPose: AvatarCameraEntryPose;
    groundYRef: RefObject<number>;
    pitchRef: RefObject<number>;
    view: Exclude<GardenAvatarView, 'overview'>;
    yawRef: RefObject<number>;
    zoomingRef: RefObject<boolean>;
}) {
    const cameraRef = useRef<ThreePerspectiveCamera>(null);
    const entryPositionRef = useRef(entryPose.position.clone());
    const entryQuaternionRef = useRef(entryPose.quaternion.clone());
    const transitionElapsedRef = useRef(0);
    const previousViewRef = useRef(view);
    const desiredPositionRef = useRef(new Vector3());
    const lookTargetRef = useRef(new Vector3());
    const horizontalForwardRef = useRef(new Vector3());
    const lookDirectionRef = useRef(new Vector3());
    const orbitDirectionRef = useRef(new Vector3());
    const desiredQuaternionRef = useRef(new Quaternion());
    const rotationHelperRef = useRef(new ThreePerspectiveCamera());

    useLayoutEffect(() => {
        const camera = cameraRef.current;
        if (!camera) {
            return;
        }
        camera.position.copy(entryPositionRef.current);
        camera.quaternion.copy(entryQuaternionRef.current);
        camera.updateMatrixWorld();
    }, []);

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
        const crouchAmount = crouchAmountRef.current;
        const horizontalForward = horizontalForwardRef.current.set(
            -Math.sin(yaw),
            0,
            -Math.cos(yaw),
        );
        const lookDirection = lookDirectionRef.current.set(
            horizontalForward.x * Math.cos(pitch),
            Math.sin(pitch),
            horizontalForward.z * Math.cos(pitch),
        );

        if (view === 'first-person') {
            desiredPositionRef.current.set(
                actor.position.x,
                actor.position.y +
                    MathUtils.lerp(
                        avatarEyeHeight,
                        avatarCrouchEyeHeight,
                        crouchAmount,
                    ),
                actor.position.z,
            );
            lookTargetRef.current
                .copy(desiredPositionRef.current)
                .addScaledVector(lookDirection, 4);
        } else {
            const orbitDirection = orbitDirectionRef.current.set(
                horizontalForward.x * Math.cos(pitch),
                Math.sin(pitch),
                horizontalForward.z * Math.cos(pitch),
            );
            lookTargetRef.current.set(
                actor.position.x,
                actor.position.y + MathUtils.lerp(0.89, 0.64, crouchAmount),
                actor.position.z,
            );
            desiredPositionRef.current
                .copy(lookTargetRef.current)
                .addScaledVector(
                    orbitDirection,
                    -MathUtils.lerp(2.45, 2.2, crouchAmount),
                );
            desiredPositionRef.current.y = Math.max(
                desiredPositionRef.current.y,
                groundYRef.current + avatarThirdPersonCameraGroundClearance,
            );
            lookTargetRef.current
                .copy(desiredPositionRef.current)
                .addScaledVector(lookDirection, 4);
        }

        const rotationHelper = rotationHelperRef.current;
        rotationHelper.position.copy(desiredPositionRef.current);
        rotationHelper.lookAt(lookTargetRef.current);
        desiredQuaternionRef.current.copy(rotationHelper.quaternion);

        const targetFov = zoomingRef.current
            ? avatarPerspectiveZoomFov
            : avatarPerspectiveFov;
        const nextFov = MathUtils.damp(
            camera.fov,
            targetFov,
            avatarZoomDamping,
            delta,
        );
        if (Math.abs(nextFov - camera.fov) > 0.000_1) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
        }

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
    }, -100);

    return (
        <PerspectiveCamera
            ref={cameraRef}
            makeDefault
            fov={avatarPerspectiveFov}
            near={0.05}
            far={10_000}
            position={entryPositionRef.current}
        />
    );
}

export function GardenAvatar({
    onPresenceChange,
    roamSeed = 'garden-avatar',
    stacks,
}: {
    onPresenceChange?: (presence: GardenAvatarPresenceState) => void;
    roamSeed?: string;
    stacks: Stack[] | undefined;
}) {
    const gltf = useGameGLTF('FarmerAvatar');
    const { data: blockData } = useBlockData();
    const view = useGameState((state) => state.gardenAvatarView);
    const setView = useGameState((state) => state.setGardenAvatarView);
    const touchMoveInput = useGameState((state) => state.gardenAvatarMoveInput);
    const touchSprintInput = useGameState(
        (state) => state.gardenAvatarSprintInput,
    );
    const touchCrouchInput = useGameState(
        (state) => state.gardenAvatarCrouchInput,
    );
    const touchZoomInput = useGameState((state) => state.gardenAvatarZoomInput);
    const jumpRequest = useGameState((state) => state.gardenAvatarJumpRequest);
    const { camera, gl } = useThree();
    const actorRef = useRef<Group>(null);
    const yawRef = useRef(0);
    const pitchRef = useRef(-0.08);
    const velocityRef = useRef(new Vector3());
    const verticalVelocityRef = useRef(0);
    const groundedRef = useRef(true);
    const groundYRef = useRef(0);
    const keyboardRef = useRef(new Set<string>());
    const jumpQueuedRef = useRef(false);
    const jumpsUsedRef = useRef(0);
    const previousJumpRequestRef = useRef(jumpRequest);
    const previousViewRef = useRef(view);
    const avatarViewRef = useRef(view);
    avatarViewRef.current = view;
    const avatarActive = view !== 'overview';
    const roamSeedRef = useRef(hashAvatarSeed(roamSeed));
    const randomRef = useRef(createRandom(roamSeedRef.current));
    const roamRef = useRef<AvatarRoamState>({ route: [], waitUntil: 4 });
    const distanceWalkedRef = useRef(0);
    const gaitAmountRef = useRef(0);
    const crouchingRef = useRef(false);
    const crouchAmountRef = useRef(0);
    const mouseZoomingRef = useRef(false);
    const zoomingRef = useRef(false);
    const presenceCallbackRef = useRef(onPresenceChange);
    presenceCallbackRef.current = onPresenceChange;
    const lastPresenceReportAtRef = useRef(Number.NEGATIVE_INFINITY);
    const cameraEntryPoseRef = useRef<AvatarCameraEntryPose>({
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
    });
    const initializedRef = useRef(false);
    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        return { ...prepareGardenAvatarModel(scene), scene };
    }, [gltf.scene]);
    const world = useMemo(
        () => createGardenAvatarCollisionWorld({ blockData, stacks }),
        [blockData, stacks],
    );
    const roamCandidates = useMemo(
        () => createRoamTargetCandidates(world),
        [world],
    );
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: 'garden-avatar',
        primaryCasterCount: view !== 'overview' ? model.primaryCasterCount : 0,
        species: 'avatar',
    });
    useSceneTimeInvalidation(true, sceneFrameRates.interactive);

    useLayoutEffect(() => {
        const castRealShadow = view !== 'overview';
        for (const mesh of model.meshes) {
            mesh.castShadow = castRealShadow;
            mesh.material =
                view === 'first-person'
                    ? model.shadowOnlyMaterial
                    : (model.materials.get(mesh) ?? mesh.material);
        }
        gl.shadowMap.needsUpdate = true;
    }, [gl, model.materials, model.meshes, model.shadowOnlyMaterial, view]);

    useEffect(
        () => () => {
            model.shadowOnlyMaterial.dispose();
        },
        [model.shadowOnlyMaterial],
    );

    useEffect(
        () => () => {
            gl.domElement.style.cursor = 'auto';
        },
        [gl.domElement],
    );

    useEffect(() => {
        if (!avatarActive) {
            return;
        }
        const previousTouchAction = gl.domElement.style.touchAction;
        gl.domElement.style.touchAction = 'none';
        return () => {
            gl.domElement.style.touchAction = previousTouchAction;
        };
    }, [avatarActive, gl.domElement]);

    useEffect(() => {
        const actor = actorRef.current;
        if (!actor) {
            return;
        }
        const defaultSpawn = findGardenAvatarSpawnPoint(world);
        if (!defaultSpawn) {
            actor.visible = false;
            return;
        }
        const nearbySpawnCandidates = roamCandidates
            .map((candidate) => ({
                candidate,
                distance: Math.hypot(
                    candidate.x - defaultSpawn.x,
                    candidate.z - defaultSpawn.z,
                ),
            }))
            .sort((left, right) => left.distance - right.distance)
            .slice(0, 12);
        const spawn =
            nearbySpawnCandidates[
                roamSeedRef.current % Math.max(nearbySpawnCandidates.length, 1)
            ]?.candidate ?? defaultSpawn;
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
    }, [roamCandidates, world]);

    useEffect(() => {
        if (jumpRequest !== previousJumpRequestRef.current) {
            previousJumpRequestRef.current = jumpRequest;
            jumpQueuedRef.current = true;
        }
    }, [jumpRequest]);

    useEffect(() => {
        if (!avatarActive) {
            keyboardRef.current.clear();
            velocityRef.current.set(0, 0, 0);
            verticalVelocityRef.current = 0;
            jumpsUsedRef.current = 0;
            crouchingRef.current = false;
            mouseZoomingRef.current = false;
            zoomingRef.current = false;
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
                -avatarPitchLimit,
                avatarPitchLimit,
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
        const clearActiveInput = () => {
            clearKeyboardInput();
            mouseZoomingRef.current = false;
        };
        const handleVisibilityChange = () => {
            if (document.hidden) {
                clearActiveInput();
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
                if (event.button === 2) {
                    event.preventDefault();
                    mouseZoomingRef.current = true;
                    if (avatarViewRef.current === 'third-person') {
                        setView('first-person');
                    }
                    return;
                }
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
            if (event.pointerType === 'mouse' && event.button === 2) {
                mouseZoomingRef.current = false;
            }
            if (event.pointerId === dragPointerId) {
                dragPointerId = null;
            }
        };
        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault();
        };

        window.addEventListener('keydown', handleKeyDown, { passive: false });
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', clearActiveInput);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('mousemove', handleMouseMove);
        gl.domElement.addEventListener('pointerdown', handlePointerDown);
        gl.domElement.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);
        gl.domElement.addEventListener('contextmenu', handleContextMenu);
        return () => {
            clearKeyboardInput();
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', clearActiveInput);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            document.removeEventListener('mousemove', handleMouseMove);
            gl.domElement.removeEventListener('pointerdown', handlePointerDown);
            gl.domElement.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
            gl.domElement.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [avatarActive, gl.domElement, setView]);

    useEffect(() => {
        if (touchZoomInput && view === 'third-person') {
            setView('first-person');
        }
    }, [setView, touchZoomInput, view]);

    function activateAvatarView() {
        const actor = actorRef.current;
        if (!actor || view !== 'overview') {
            return;
        }
        getGardenAvatarPerspectiveEntryPosition({
            actor,
            camera,
            perspectiveFov: avatarPerspectiveFov,
            target: cameraEntryPoseRef.current.position,
        });
        camera.getWorldQuaternion(cameraEntryPoseRef.current.quaternion);
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
                    actor.position.x = movement.position.x;
                    actor.position.z = movement.position.z;
                    groundYRef.current = movement.position.y;
                    actor.rotation.y = dampGardenAvatarAngle(
                        actor.rotation.y,
                        -Math.atan2(dx, -dz),
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
            actor.position.y = MathUtils.damp(
                actor.position.y,
                groundYRef.current,
                avatarGroundDamping,
                delta,
            );
            groundedRef.current = true;
        } else {
            const keys = keyboardRef.current;
            const crouchRequested =
                touchCrouchInput ||
                keys.has('ControlLeft') ||
                keys.has('ControlRight');
            let crouching =
                crouchRequested ||
                (!groundedRef.current && crouchingRef.current);
            if (
                !crouchRequested &&
                crouchingRef.current &&
                groundedRef.current
            ) {
                crouching =
                    getGardenAvatarGroundY({
                        collisionHeight: gardenAvatarStandingCollisionHeight,
                        currentGroundY: groundYRef.current,
                        position: actor.position,
                        world,
                    }) === null;
            }
            crouchingRef.current = crouching;
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
            const targetSpeed = crouching
                ? avatarCrouchSpeed
                : touchSprintInput ||
                    keys.has('ShiftLeft') ||
                    keys.has('ShiftRight')
                  ? avatarRunSpeed
                  : avatarWalkSpeed;
            const forwardX = -Math.sin(yawRef.current);
            const forwardZ = -Math.cos(yawRef.current);
            const rightX = Math.cos(yawRef.current);
            const rightZ = -Math.sin(yawRef.current);
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

            const previousGroundY = groundYRef.current;
            const availableClimbHeight = groundedRef.current
                ? gardenAvatarMaxStepHeight
                : Math.min(
                      gardenAvatarMaxJumpClimbHeight,
                      Math.max(
                          gardenAvatarMaxStepHeight,
                          actor.position.y - groundYRef.current + 0.08,
                      ),
                  );
            const movement = resolveGardenAvatarHorizontalMovement({
                collisionHeight: crouching
                    ? gardenAvatarCrouchingCollisionHeight
                    : gardenAvatarStandingCollisionHeight,
                deltaX: velocity.x * delta,
                deltaZ: velocity.z * delta,
                maxStepHeight: availableClimbHeight,
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
            if (
                groundedRef.current &&
                previousGroundY - groundYRef.current > gardenAvatarMaxStepHeight
            ) {
                groundedRef.current = false;
                jumpsUsedRef.current = Math.max(jumpsUsedRef.current, 1);
                verticalVelocityRef.current = 0;
            }
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
            actor.rotation.y = dampGardenAvatarAngle(
                actor.rotation.y,
                yawRef.current,
                avatarTurnDamping,
                delta,
            );

            if (jumpQueuedRef.current) {
                const nextJumpCount = getGardenAvatarNextJumpCount({
                    grounded: groundedRef.current,
                    jumpsUsed: jumpsUsedRef.current,
                });
                if (nextJumpCount !== null) {
                    jumpsUsedRef.current = nextJumpCount;
                    verticalVelocityRef.current = avatarJumpVelocity;
                    groundedRef.current = false;
                }
            }
            jumpQueuedRef.current = false;
            if (groundedRef.current) {
                actor.position.y = MathUtils.damp(
                    actor.position.y,
                    groundYRef.current,
                    avatarGroundDamping,
                    delta,
                );
            } else {
                verticalVelocityRef.current -= avatarGravity * delta;
                const nextY =
                    actor.position.y + verticalVelocityRef.current * delta;
                const ceilingY = getGardenAvatarCeilingY({
                    collisionHeight: crouching
                        ? gardenAvatarCrouchingCollisionHeight
                        : gardenAvatarStandingCollisionHeight,
                    position: {
                        x: actor.position.x,
                        y: actor.position.y,
                        z: actor.position.z,
                    },
                    world,
                });
                if (
                    verticalVelocityRef.current > 0 &&
                    ceilingY !== null &&
                    nextY >= ceilingY
                ) {
                    actor.position.y = ceilingY;
                    verticalVelocityRef.current = 0;
                } else {
                    actor.position.y = nextY;
                }
                if (actor.position.y <= groundYRef.current) {
                    actor.position.y = groundYRef.current;
                    verticalVelocityRef.current = 0;
                    groundedRef.current = true;
                    jumpsUsedRef.current = 0;
                }
            }
        }

        gaitAmountRef.current = MathUtils.damp(
            gaitAmountRef.current,
            MathUtils.clamp(movingSpeed / avatarWalkSpeed, 0, 1),
            9,
            delta,
        );
        crouchAmountRef.current = MathUtils.damp(
            crouchAmountRef.current,
            crouchingRef.current ? 1 : 0,
            18,
            delta,
        );
        zoomingRef.current = mouseZoomingRef.current || touchZoomInput;
        animateGardenAvatarRig({
            crouchAmount: crouchAmountRef.current,
            delta,
            distanceWalked: distanceWalkedRef.current,
            grounded: groundedRef.current,
            headPitch: view === 'overview' ? 0 : pitchRef.current,
            rig: model.rig,
            walkAmount: gaitAmountRef.current,
        });
        if (view !== 'overview') {
            gl.shadowMap.needsUpdate = true;
        }
        updateActorGroundingShadow?.({
            actorY: actor.position.y,
            receiverY: groundYRef.current,
            visible: actor.visible && view === 'overview',
            x: actor.position.x,
            yaw: actor.rotation.y,
            z: actor.position.z,
        });
        if (
            presenceCallbackRef.current &&
            now - lastPresenceReportAtRef.current >= 0.1
        ) {
            lastPresenceReportAtRef.current = now;
            presenceCallbackRef.current({
                crouchAmount: crouchAmountRef.current,
                grounded: groundedRef.current,
                headPitch: view === 'overview' ? 0 : pitchRef.current,
                movingSpeed,
                position: [
                    actor.position.x,
                    actor.position.y,
                    actor.position.z,
                ],
                view,
                yaw: Math.atan2(
                    Math.sin(actor.rotation.y),
                    Math.cos(actor.rotation.y),
                ),
            });
        }
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
                    position={[0, 0.6, 0]}
                    scale={[0.76, 1.32, 0.76]}
                >
                    <boxGeometry />
                    <meshBasicMaterial
                        colorWrite={false}
                        depthWrite={false}
                        transparent
                        opacity={0}
                    />
                </mesh>
                <group scale={avatarModelScale}>
                    <primitive object={model.scene} />
                </group>
                {view === 'overview' ? (
                    <Html center position={[0, 1.43, 0]} zIndexRange={[30, 20]}>
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
                    crouchAmountRef={crouchAmountRef}
                    entryPose={cameraEntryPoseRef.current}
                    groundYRef={groundYRef}
                    pitchRef={pitchRef}
                    view={view}
                    yawRef={yawRef}
                    zoomingRef={zoomingRef}
                />
            ) : null}
        </>
    );
}
