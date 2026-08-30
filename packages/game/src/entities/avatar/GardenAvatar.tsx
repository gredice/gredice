import { Html, PerspectiveCamera } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
    type RefObject,
    useCallback,
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
    Raycaster,
    PerspectiveCamera as ThreePerspectiveCamera,
    Vector2,
    Vector3,
} from 'three';
import { blockInteractionPassthroughUserDataKey } from '../../controls/BlockInteractionResolver';
import { useBlockData } from '../../hooks/useBlockData';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    type GardenAvatarView,
    useGameState,
    useGameStateStore,
} from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import {
    ActorSpeechBubble,
    useActorHoverSpeech,
} from '../animals/ActorSpeechBubble';
import { playerSpeechMessages } from '../animals/actorSpeechMessages';
import {
    type FishingBoatController,
    type FishingBoatOarController,
    useFishingBoatRegistry,
} from '../fishingBoat/FishingBoatRegistry';
import {
    createFishingBoatNavigationGrid,
    isFishingBoatNavigablePose,
    resolveFishingBoatNavigation,
} from '../fishingBoat/fishingBoatNavigation';
import {
    fishingBoatOarRotationOrder,
    getFishingBoatOarPose,
} from '../fishingBoat/fishingBoatRowing';
import { GardenAvatarCollisionDebug } from './GardenAvatarCollisionDebug';
import {
    getGardenAvatarPerspectiveEntryPosition,
    getGardenAvatarThirdPersonCameraDistance,
    getGardenAvatarThirdPersonCameraTargetHeight,
} from './gardenAvatarCamera';
import {
    getGardenAvatarCameraFov,
    normalizeGardenAvatarWheelDeltaY,
} from './gardenAvatarCameraZoom';
import {
    findGardenAvatarCactusContact,
    findGardenAvatarSeatExit,
    type GardenAvatarInteractionResult,
    type GardenAvatarSeatPose,
    gardenAvatarBeachBallKickDistance,
    getGardenAvatarBlockInteractionTargets,
    getGardenAvatarCactusBounceDirection,
    getGardenAvatarForwardDirection,
    getGardenAvatarPointerLockIntent,
    getGardenAvatarSeatPose,
    isGardenAvatarInteractionOccluded,
    isPettableAnimalSpecies,
    normalizeGardenAvatarInteractionResult,
    resolveAimedGardenAvatarAnimal,
    resolveAimedGardenAvatarBlock,
} from './gardenAvatarInteractions';
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
    getGardenAvatarRoamTargets,
    mergeGardenAvatarCollisionWorlds,
    resolveGardenAvatarHorizontalMovement,
} from './gardenAvatarMovement';
import {
    getGardenAvatarZoomReleaseView,
    getGardenAvatarZoomStart,
} from './gardenAvatarZoomView';
import type { GardenAvatarPresenceState } from './gardenVisitorPresence';

export const avatarModelScale = 0.697;
const avatarEyeHeight = 1.2;
const avatarSpeechBubbleOffsetY = 1.85;
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
const fishingBoatInteractionRange = 3.2;
const fishingBoatForwardSpeed = 1.75;
const fishingBoatReverseSpeed = 0.9;
const fishingBoatAcceleration = 3.8;
const fishingBoatDeceleration = 5.2;
const fishingBoatTurnSpeed = 1.45;
const fishingBoatSeatHeight = 0.27;
const fishingBoatSeatOffset = 0.27;
const fishingBoatOarStrokeDamping = 12;

function applyFishingBoatOarPose({
    delta,
    distance,
    mounted,
    oars,
    rowingAmount,
}: {
    delta?: number;
    distance: number;
    mounted: boolean;
    oars: FishingBoatOarController[];
    rowingAmount: number;
}) {
    for (const oar of oars) {
        const pose = getFishingBoatOarPose({
            distance,
            mounted,
            rowingAmount,
            side: oar.side,
        });
        const [, pivotY] = oar.pivot;
        oar.group.position.y = pivotY + pose.lift;
        oar.group.rotation.set(
            0,
            delta === undefined
                ? pose.yaw
                : MathUtils.damp(
                      oar.group.rotation.y,
                      pose.yaw,
                      fishingBoatOarStrokeDamping,
                      delta,
                  ),
            pose.tilt,
            fishingBoatOarRotationOrder,
        );
    }
}

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

function isGardenAvatarInputBlocked(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    // Avatar interactions can open a modal on top of the scene, and keys typed
    // into it must not steer the avatar hidden behind it.
    return (
        target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('[role="dialog"]') !== null
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
    seated = false,
}: {
    crouchAmount: number;
    delta: number;
    distanceWalked: number;
    grounded: boolean;
    headPitch: number;
    walkAmount: number;
    rig: AvatarRig;
    seated?: boolean;
}) {
    const walkPhase = (distanceWalked / 0.82) * Math.PI * 2;
    const phaseSine = Math.sin(walkPhase);
    const legSwing = grounded ? phaseSine * 0.44 * walkAmount : -0.2;
    const armSwing = grounded ? phaseSine * 0.34 * walkAmount : -0.48;
    const leftKneeBend = seated
        ? -1.2
        : grounded
          ? Math.max(0, -phaseSine) * 0.38 * walkAmount + crouchAmount * 0.82
          : 0.42;
    const rightKneeBend = seated
        ? -1.2
        : grounded
          ? Math.max(0, phaseSine) * 0.38 * walkAmount + crouchAmount * 0.82
          : 0.42;
    const leftElbowBend = Math.abs(leftKneeBend);
    const rightElbowBend = Math.abs(rightKneeBend);
    const leftLegRotation = seated ? 1.02 : legSwing;
    const rightLegRotation = seated ? 1.02 : -legSwing;
    const leftArmRotation = seated ? -0.46 : -armSwing;
    const rightArmRotation = seated ? -0.46 : armSwing;
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
            leftLegRotation,
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
            rightLegRotation,
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
            leftArmRotation,
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
            rightArmRotation,
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
            grounded ? -0.12 - leftElbowBend * 0.16 : -0.5,
            poseDamping,
        );
    }
    if (rig.elbowRight) {
        rig.elbowRight.rotation.x = MathUtils.lerp(
            rig.elbowRight.rotation.x,
            grounded ? -0.12 - rightElbowBend * 0.16 : -0.5,
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
    const zoom = useGameState((state) => state.gardenAvatarCameraZoom);
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
                actor.position.y +
                    getGardenAvatarThirdPersonCameraTargetHeight(crouchAmount),
                actor.position.z,
            );
            desiredPositionRef.current
                .copy(lookTargetRef.current)
                .addScaledVector(
                    orbitDirection,
                    -getGardenAvatarThirdPersonCameraDistance({
                        aspect: camera.aspect,
                        crouchAmount,
                    }),
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
            : getGardenAvatarCameraFov({
                  defaultFov: avatarPerspectiveFov,
                  zoom,
              });
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
    activationRequest = 0,
    additionalCollisionWorld,
    initialSpawnPoint,
    interactionDisabled = false,
    interactiveBlockIds,
    onInteractBlock,
    onPresenceChange,
    roamSeed = 'garden-avatar',
    showActivationPrompt = true,
    stacks,
}: {
    activationRequest?: number;
    additionalCollisionWorld?: GardenAvatarCollisionWorld;
    initialSpawnPoint?: Pick<GardenAvatarPoint, 'x' | 'z'>;
    interactionDisabled?: boolean;
    interactiveBlockIds?: ReadonlySet<string>;
    onInteractBlock?: (block: Block) => boolean | GardenAvatarInteractionResult;
    onPresenceChange?: (presence: GardenAvatarPresenceState) => void;
    roamSeed?: string;
    showActivationPrompt?: boolean;
    stacks: Stack[] | undefined;
}) {
    const gltf = useGameGLTF('FarmerAvatar');
    const { data: blockData } = useBlockData();
    const gameStateStore = useGameStateStore();
    const view = useGameState((state) => state.gardenAvatarView);
    const collisionDebugVisible = useGameState(
        (state) => state.gardenAvatarCollisionDebugVisible,
    );
    const setView = useGameState((state) => state.setGardenAvatarView);
    const touchMoveInput = useGameState((state) => state.gardenAvatarMoveInput);
    const touchSprintInput = useGameState(
        (state) => state.gardenAvatarSprintInput,
    );
    const touchCrouchInput = useGameState(
        (state) => state.gardenAvatarCrouchInput,
    );
    const scaleCameraZoom = useGameState(
        (state) => state.scaleGardenAvatarCameraZoom,
    );
    const jumpRequest = useGameState((state) => state.gardenAvatarJumpRequest);
    const boatId = useGameState((state) => state.gardenAvatarBoatId);
    const aimedBoatId = useGameState((state) => state.gardenAvatarAimedBoatId);
    const setBoatId = useGameState((state) => state.setGardenAvatarBoatId);
    const setAimedBoatId = useGameState(
        (state) => state.setGardenAvatarAimedBoatId,
    );
    const seatId = useGameState((state) => state.gardenAvatarSeatId);
    const setSeatId = useGameState((state) => state.setGardenAvatarSeatId);
    const setAvatarPresence = useGameState(
        (state) => state.setGardenAvatarPresence,
    );
    const petAnimal = useGameState((state) => state.petGardenAvatarAnimal);
    const kickBeachBall = useGameState(
        (state) => state.kickGardenAvatarBeachBall,
    );
    const fishingBoatRegistry = useFishingBoatRegistry();
    const { camera, clock, gl, scene } = useThree();
    const actorRef = useRef<Group>(null);
    const yawRef = useRef(0);
    const pitchRef = useRef(-0.08);
    const velocityRef = useRef(new Vector3());
    const mountedBoatRef = useRef<FishingBoatController | null>(null);
    const boatSpeedRef = useRef(0);
    const boatYawRef = useRef(0);
    const boatRowDistanceRef = useRef(0);
    const boatWorldPositionRef = useRef(new Vector3());
    const boatSeatOffsetRef = useRef(new Vector3());
    const lastBoatAimCheckAtRef = useRef(Number.NEGATIVE_INFINITY);
    const lastCactusBounceAtRef = useRef(Number.NEGATIVE_INFINITY);
    const lastBeachBallKickAtRef = useRef(new Map<string, number>());
    const interactionRaycasterRef = useRef(new Raycaster());
    const interactionRayCenterRef = useRef(new Vector2(0, 0));
    const verticalVelocityRef = useRef(0);
    const groundedRef = useRef(true);
    const groundYRef = useRef(0);
    const keyboardRef = useRef(new Set<string>());
    const jumpQueuedRef = useRef(false);
    const jumpsUsedRef = useRef(0);
    const previousJumpRequestRef = useRef(jumpRequest);
    const previousActivationRequestRef = useRef(0);
    const previousViewRef = useRef(view);
    const previousSeatPoseRef = useRef<GardenAvatarSeatPose | null>(null);
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
    const mouseZoomReturnsToThirdPersonRef = useRef(false);
    const zoomingRef = useRef(false);
    const presenceCallbackRef = useRef(onPresenceChange);
    presenceCallbackRef.current = onPresenceChange;
    const lastPresenceReportAtRef = useRef(Number.NEGATIVE_INFINITY);
    const cameraEntryPoseRef = useRef<AvatarCameraEntryPose>({
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
    });
    const initializedRef = useRef(false);
    const {
        dismissMessage: dismissSpeechMessage,
        message: speechMessage,
        showMessage: showSpeechMessage,
    } = useActorHoverSpeech(playerSpeechMessages);
    const finishTemporaryZoom = useCallback(() => {
        if (mouseZoomingRef.current) {
            return;
        }

        const restoreThirdPerson = mouseZoomReturnsToThirdPersonRef.current;
        mouseZoomReturnsToThirdPersonRef.current = false;
        const currentView = avatarViewRef.current;
        const nextView = getGardenAvatarZoomReleaseView({
            restoreThirdPerson,
            view: currentView,
        });
        if (nextView !== currentView) {
            avatarViewRef.current = nextView;
            setView(nextView);
        }
    }, [setView]);
    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        return { ...prepareGardenAvatarModel(scene), scene };
    }, [gltf.scene]);
    const blockCollisionWorld = useMemo(
        () => createGardenAvatarCollisionWorld({ blockData, stacks }),
        [blockData, stacks],
    );
    const world = useMemo(
        () =>
            additionalCollisionWorld
                ? mergeGardenAvatarCollisionWorlds(
                      blockCollisionWorld,
                      additionalCollisionWorld,
                  )
                : blockCollisionWorld,
        [additionalCollisionWorld, blockCollisionWorld],
    );
    const interactionTargets = useMemo(
        () =>
            getGardenAvatarBlockInteractionTargets({
                blockData,
                interactiveBlockIds,
                stacks,
            }),
        [blockData, interactiveBlockIds, stacks],
    );
    const seatPose = useMemo(() => {
        const target = interactionTargets.find(
            (candidate) => candidate.block.id === seatId,
        );
        return target ? getGardenAvatarSeatPose(target) : null;
    }, [interactionTargets, seatId]);
    const standUpFromSeat = useCallback(() => {
        if (!seatPose || !findGardenAvatarSeatExit({ pose: seatPose, world })) {
            return false;
        }

        setSeatId(null);
        return true;
    }, [seatPose, setSeatId, world]);
    const roamCandidates = useMemo(
        () => getGardenAvatarRoamTargets(world),
        [world],
    );
    const fishingBoatNavigationGrid = useMemo(
        () => createFishingBoatNavigationGrid(stacks),
        [stacks],
    );
    const boardAimedFishingBoat = useCallback(() => {
        const actor = actorRef.current;
        const controller = fishingBoatRegistry?.resolveAimed(camera);
        if (!actor || !controller || mountedBoatRef.current) {
            return false;
        }

        controller.object.updateWorldMatrix(true, false);
        const boatPosition = controller.object.getWorldPosition(
            boatWorldPositionRef.current,
        );
        if (
            Math.hypot(
                boatPosition.x - actor.position.x,
                boatPosition.z - actor.position.z,
            ) > fishingBoatInteractionRange
        ) {
            return false;
        }

        mountedBoatRef.current = controller;
        boatSpeedRef.current = 0;
        boatRowDistanceRef.current = 0;
        boatYawRef.current = controller.object.rotation.y;
        // Swing the oars straight out instead of animating the deploy, which
        // would sweep them through the hull on the way.
        applyFishingBoatOarPose({
            distance: 0,
            mounted: true,
            oars: controller.oars,
            rowingAmount: 0,
        });
        velocityRef.current.set(0, 0, 0);
        verticalVelocityRef.current = 0;
        groundedRef.current = true;
        jumpsUsedRef.current = 0;
        crouchingRef.current = true;
        yawRef.current = boatYawRef.current;
        setBoatId(controller.blockId);
        return true;
    }, [camera, fishingBoatRegistry, setBoatId]);
    const interactWithAimedTarget = useCallback(() => {
        const actor = actorRef.current;
        if (!actor || mountedBoatRef.current) {
            return 'ignored';
        }

        if (boardAimedFishingBoat()) {
            return 'handled';
        }

        const raycaster = interactionRaycasterRef.current;
        raycaster.setFromCamera(interactionRayCenterRef.current, camera);
        const blockResolution = resolveAimedGardenAvatarBlock({
            actorPosition: actor.position,
            ray: raycaster.ray,
            targets: interactionTargets,
        });
        const isOccluded = (hitPoint: Vector3) =>
            isGardenAvatarInteractionOccluded({
                intersections: raycaster.intersectObjects(scene.children, true),
                layerObject: actor,
                ray: raycaster.ray,
                resolvedHitPoint: hitPoint,
            });
        if (blockResolution && !isOccluded(blockResolution.hitPoint)) {
            const blockTarget = blockResolution.target;
            if (blockTarget.block.name === 'BeachBall') {
                kickBeachBall({
                    direction: getGardenAvatarForwardDirection(
                        actor.rotation.y,
                    ),
                    targetId: blockTarget.block.id,
                });
                return 'handled';
            }

            if (getGardenAvatarSeatPose(blockTarget)) {
                setSeatId(blockTarget.block.id);
                return 'handled';
            }

            if (onInteractBlock) {
                return normalizeGardenAvatarInteractionResult(
                    onInteractBlock(blockTarget.block),
                );
            }
        }

        const animalResolution = resolveAimedGardenAvatarAnimal({
            actorPosition: actor.position,
            entries: gameStateStore.getState().animalPresenceEntries,
            now: clock.elapsedTime,
            ray: raycaster.ray,
        });
        const animal =
            animalResolution && !isOccluded(animalResolution.hitPoint)
                ? animalResolution.entry
                : null;
        if (animal && isPettableAnimalSpecies(animal.species)) {
            petAnimal({
                species: animal.species,
                targetId: animal.id,
            });
            return 'handled';
        }

        return 'ignored';
    }, [
        boardAimedFishingBoat,
        camera,
        clock,
        gameStateStore,
        interactionTargets,
        kickBeachBall,
        onInteractBlock,
        petAnimal,
        scene,
        setSeatId,
    ]);
    const dismountFishingBoat = useCallback(() => {
        const actor = actorRef.current;
        const mountedBoat = mountedBoatRef.current;
        if (actor && mountedBoat) {
            mountedBoat.object.updateWorldMatrix(true, false);
            const boatPosition = mountedBoat.object.getWorldPosition(
                boatWorldPositionRef.current,
            );
            const fallbackSpawn = findGardenAvatarSpawnPoint(world);
            const shore = roamCandidates.reduce<GardenAvatarPoint | null>(
                (nearest, candidate) => {
                    if (!nearest) {
                        return candidate;
                    }
                    const nearestDistance = Math.hypot(
                        nearest.x - boatPosition.x,
                        nearest.z - boatPosition.z,
                    );
                    const candidateDistance = Math.hypot(
                        candidate.x - boatPosition.x,
                        candidate.z - boatPosition.z,
                    );
                    return candidateDistance < nearestDistance
                        ? candidate
                        : nearest;
                },
                fallbackSpawn,
            );
            if (shore) {
                actor.position.set(shore.x, shore.y, shore.z);
                groundYRef.current = shore.y;
                actor.rotation.y = boatYawRef.current;
            }
            applyFishingBoatOarPose({
                distance: 0,
                mounted: false,
                oars: mountedBoat.oars,
                rowingAmount: 0,
            });
        }

        mountedBoatRef.current = null;
        boatSpeedRef.current = 0;
        boatRowDistanceRef.current = 0;
        velocityRef.current.set(0, 0, 0);
        verticalVelocityRef.current = 0;
        groundedRef.current = true;
        crouchingRef.current = false;
        jumpsUsedRef.current = 0;
        setBoatId(null);
    }, [roamCandidates, setBoatId, world]);
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: 'garden-avatar',
        primaryCasterCount: view !== 'overview' ? model.primaryCasterCount : 0,
        species: 'avatar',
    });
    useSceneTimeInvalidation(true, sceneFrameRates.interactive);

    useEffect(() => {
        if (!boatId && mountedBoatRef.current) {
            dismountFishingBoat();
        }
    }, [boatId, dismountFishingBoat]);

    useEffect(() => {
        if (seatId && !seatPose) {
            setSeatId(null);
        }
    }, [seatId, seatPose, setSeatId]);

    useEffect(() => {
        if (seatPose) {
            previousSeatPoseRef.current = seatPose;
            return;
        }
        const previousSeatPose = previousSeatPoseRef.current;
        const actor = actorRef.current;
        if (!previousSeatPose || !actor) {
            return;
        }

        const exit = findGardenAvatarSeatExit({
            pose: previousSeatPose,
            world,
        });
        if (!exit) {
            const seatStillExists = interactionTargets.some(
                (target) => target.block.id === previousSeatPose.blockId,
            );
            if (seatStillExists) {
                setSeatId(previousSeatPose.blockId);
            } else {
                previousSeatPoseRef.current = null;
            }
            return;
        }

        previousSeatPoseRef.current = null;
        actor.position.set(exit.x, exit.y, exit.z);
        groundYRef.current = exit.y;
        velocityRef.current.set(0, 0, 0);
        verticalVelocityRef.current = 0;
        groundedRef.current = true;
    }, [interactionTargets, seatPose, setSeatId, world]);

    useEffect(() => {
        if (!avatarActive) {
            setAvatarPresence(null);
        }
    }, [avatarActive, setAvatarPresence]);

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
        const defaultSpawn = findGardenAvatarSpawnPoint(
            world,
            initialSpawnPoint,
        );
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
        const spawn = initialSpawnPoint
            ? defaultSpawn
            : (nearbySpawnCandidates[
                  roamSeedRef.current %
                      Math.max(nearbySpawnCandidates.length, 1)
              ]?.candidate ?? defaultSpawn);
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
    }, [initialSpawnPoint, roamCandidates, world]);

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
            mouseZoomReturnsToThirdPersonRef.current = false;
            zoomingRef.current = false;
            if (document.pointerLockElement === gl.domElement) {
                document.exitPointerLock();
            }
            return;
        }

        let dragPointerId: number | null = null;
        let lastPointerX = 0;
        let lastPointerY = 0;
        let touchPinchDistance: number | null = null;
        const activeTouchPointers = new Map<number, Vector2>();

        const getTouchPinchDistance = () => {
            const [firstPointer, secondPointer] = Array.from(
                activeTouchPointers.values(),
            );
            if (!firstPointer || !secondPointer) {
                return null;
            }

            return firstPointer.distanceTo(secondPointer);
        };

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
            if (isGardenAvatarInputBlocked(event.target)) {
                return;
            }
            if (event.code === 'Space' || event.code.startsWith('Arrow')) {
                event.preventDefault();
            }
            if (event.code === 'Escape') {
                setView('overview');
                return;
            }
            if (
                event.code === 'KeyE' &&
                !event.repeat &&
                (mountedBoatRef.current || seatId)
            ) {
                event.preventDefault();
                if (mountedBoatRef.current) {
                    dismountFishingBoat();
                } else {
                    standUpFromSeat();
                }
                return;
            }
            if (
                event.code === 'Space' &&
                !event.repeat &&
                !mountedBoatRef.current
            ) {
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
            activeTouchPointers.clear();
            dragPointerId = null;
            touchPinchDistance = null;
            mouseZoomingRef.current = false;
            finishTemporaryZoom();
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
                    if (!mouseZoomingRef.current) {
                        const zoomStart = getGardenAvatarZoomStart(
                            avatarViewRef.current,
                        );
                        mouseZoomReturnsToThirdPersonRef.current =
                            zoomStart.restoreThirdPerson;
                        if (zoomStart.view !== avatarViewRef.current) {
                            avatarViewRef.current = zoomStart.view;
                            setView(zoomStart.view);
                        }
                    }
                    mouseZoomingRef.current = true;
                    return;
                }
                if (event.button === 0) {
                    const intent = getGardenAvatarPointerLockIntent({
                        locked: document.pointerLockElement === gl.domElement,
                        result: interactWithAimedTarget(),
                    });
                    if (intent === 'lock') {
                        void gl.domElement.requestPointerLock();
                    } else if (intent === 'unlock') {
                        document.exitPointerLock();
                    }
                }
                return;
            }
            if (interactWithAimedTarget() !== 'ignored') {
                return;
            }
            activeTouchPointers.set(
                event.pointerId,
                new Vector2(event.clientX, event.clientY),
            );
            gl.domElement.setPointerCapture(event.pointerId);
            const nextPinchDistance = getTouchPinchDistance();
            if (nextPinchDistance !== null) {
                dragPointerId = null;
                touchPinchDistance = nextPinchDistance;
                return;
            }
            dragPointerId = event.pointerId;
            lastPointerX = event.clientX;
            lastPointerY = event.clientY;
        };
        const handlePointerMove = (event: PointerEvent) => {
            if (activeTouchPointers.has(event.pointerId)) {
                activeTouchPointers.set(
                    event.pointerId,
                    new Vector2(event.clientX, event.clientY),
                );
                const nextPinchDistance = getTouchPinchDistance();
                if (nextPinchDistance !== null) {
                    if (touchPinchDistance !== null && touchPinchDistance > 0) {
                        scaleCameraZoom(nextPinchDistance / touchPinchDistance);
                    }
                    dragPointerId = null;
                    touchPinchDistance = nextPinchDistance;
                    return;
                }
            }
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
                finishTemporaryZoom();
            }
            if (event.pointerType !== 'mouse') {
                activeTouchPointers.delete(event.pointerId);
                if (gl.domElement.hasPointerCapture(event.pointerId)) {
                    gl.domElement.releasePointerCapture(event.pointerId);
                }
                touchPinchDistance = getTouchPinchDistance();
                const remainingPointer = Array.from(
                    activeTouchPointers.entries(),
                )[0];
                if (remainingPointer) {
                    dragPointerId = remainingPointer[0];
                    lastPointerX = remainingPointer[1].x;
                    lastPointerY = remainingPointer[1].y;
                } else {
                    dragPointerId = null;
                }
            }
        };
        const handleWheel = (event: WheelEvent) => {
            if (event.deltaY === 0) {
                return;
            }

            event.preventDefault();
            const normalizedDeltaY = normalizeGardenAvatarWheelDeltaY({
                deltaMode: event.deltaMode,
                deltaY: event.deltaY,
                pageHeight: gl.domElement.clientHeight,
            });
            scaleCameraZoom(Math.exp(-normalizedDeltaY * 0.001));
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
        gl.domElement.addEventListener('wheel', handleWheel, {
            passive: false,
        });
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
            gl.domElement.removeEventListener('wheel', handleWheel);
            gl.domElement.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [
        avatarActive,
        dismountFishingBoat,
        finishTemporaryZoom,
        gl.domElement,
        interactWithAimedTarget,
        scaleCameraZoom,
        seatId,
        standUpFromSeat,
        setView,
    ]);

    const activateAvatarView = useCallback(() => {
        const actor = actorRef.current;
        if (!actor || interactionDisabled || view !== 'overview') {
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
        dismissSpeechMessage();
        setView('third-person');
    }, [camera, dismissSpeechMessage, interactionDisabled, setView, view]);

    useEffect(() => {
        if (!interactionDisabled) {
            return;
        }
        gl.domElement.style.cursor = 'auto';
        dismissSpeechMessage();
    }, [dismissSpeechMessage, gl.domElement, interactionDisabled]);

    useEffect(() => {
        if (
            activationRequest <= previousActivationRequestRef.current ||
            view !== 'overview'
        ) {
            return;
        }

        previousActivationRequestRef.current = activationRequest;
        activateAvatarView();
    }, [activationRequest, activateAvatarView, view]);

    function enterAvatarView(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        activateAvatarView();
    }

    function stopAvatarPointer(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
    }

    function showAvatarPointer(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        if (!interactionDisabled && view === 'overview') {
            gl.domElement.style.cursor = 'pointer';
            showSpeechMessage();
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

        const mountedBoat = mountedBoatRef.current;
        if (
            mountedBoat &&
            fishingBoatRegistry?.get(mountedBoat.blockId) !== mountedBoat
        ) {
            dismountFishingBoat();
        }

        if (
            view !== 'overview' &&
            !mountedBoatRef.current &&
            now - lastBoatAimCheckAtRef.current >= 0.1
        ) {
            lastBoatAimCheckAtRef.current = now;
            const aimedBoat = fishingBoatRegistry?.resolveAimed(camera) ?? null;
            if (aimedBoat) {
                aimedBoat.object.updateWorldMatrix(true, false);
            }
            const aimedBoatPosition = aimedBoat?.object.getWorldPosition(
                boatWorldPositionRef.current,
            );
            const nextAimedBoatId =
                aimedBoat &&
                aimedBoatPosition &&
                Math.hypot(
                    aimedBoatPosition.x - actor.position.x,
                    aimedBoatPosition.z - actor.position.z,
                ) <= fishingBoatInteractionRange
                    ? aimedBoat.blockId
                    : null;
            if (aimedBoatId !== nextAimedBoatId) {
                setAimedBoatId(nextAimedBoatId);
            }
        } else if (
            (view === 'overview' || mountedBoatRef.current) &&
            aimedBoatId !== null
        ) {
            setAimedBoatId(null);
        }

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
        } else if (seatPose) {
            const keys = keyboardRef.current;
            const wantsToStand =
                jumpQueuedRef.current ||
                Math.hypot(touchMoveInput.forward, touchMoveInput.right) >
                    0.08 ||
                keys.has('KeyW') ||
                keys.has('KeyA') ||
                keys.has('KeyS') ||
                keys.has('KeyD') ||
                keys.has('ArrowUp') ||
                keys.has('ArrowDown') ||
                keys.has('ArrowLeft') ||
                keys.has('ArrowRight');
            if (wantsToStand) {
                jumpQueuedRef.current = false;
                standUpFromSeat();
            }

            actor.position.set(seatPose.x, seatPose.y, seatPose.z);
            actor.rotation.y = seatPose.yaw;
            yawRef.current = seatPose.yaw;
            groundYRef.current = seatPose.y;
            velocityRef.current.set(0, 0, 0);
            verticalVelocityRef.current = 0;
            groundedRef.current = true;
            crouchingRef.current = true;
            jumpsUsedRef.current = 0;
        } else if (mountedBoatRef.current) {
            const controller = mountedBoatRef.current;
            const boat = controller.object;
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
            const targetSpeed =
                inputForward >= 0
                    ? inputForward * fishingBoatForwardSpeed
                    : inputForward * fishingBoatReverseSpeed;
            boatSpeedRef.current = MathUtils.damp(
                boatSpeedRef.current,
                targetSpeed,
                Math.abs(inputForward) > 0
                    ? fishingBoatAcceleration
                    : fishingBoatDeceleration,
                delta,
            );

            const previousYaw = boatYawRef.current;
            const travelDirection = Math.sign(boatSpeedRef.current) || 1;
            const requestedYaw =
                previousYaw -
                inputRight * fishingBoatTurnSpeed * travelDirection * delta;
            const nextYaw = isFishingBoatNavigablePose({
                grid: fishingBoatNavigationGrid,
                x: boat.position.x,
                yaw: requestedYaw,
                z: boat.position.z,
            })
                ? requestedYaw
                : previousYaw;
            const travel = boatSpeedRef.current * delta;
            boatRowDistanceRef.current += Math.abs(travel);
            const navigation = resolveFishingBoatNavigation({
                deltaX: -Math.sin(nextYaw) * travel,
                deltaZ: -Math.cos(nextYaw) * travel,
                grid: fishingBoatNavigationGrid,
                x: boat.position.x,
                yaw: nextYaw,
                z: boat.position.z,
            });
            if (!navigation.moved) {
                boatSpeedRef.current = MathUtils.damp(
                    boatSpeedRef.current,
                    0,
                    fishingBoatDeceleration,
                    delta,
                );
            }
            boat.position.x = navigation.x;
            boat.position.z = navigation.z;
            boat.rotation.y = navigation.yaw;
            boatYawRef.current = navigation.yaw;
            boat.updateWorldMatrix(true, false);
            const boatPosition = boat.getWorldPosition(
                boatWorldPositionRef.current,
            );
            const seatOffset = boatSeatOffsetRef.current.set(
                Math.sin(navigation.yaw) * fishingBoatSeatOffset,
                fishingBoatSeatHeight,
                Math.cos(navigation.yaw) * fishingBoatSeatOffset,
            );
            actor.position.copy(boatPosition).add(seatOffset);
            actor.rotation.y = navigation.yaw;
            groundYRef.current = boatPosition.y;
            groundedRef.current = true;
            verticalVelocityRef.current = 0;
            jumpsUsedRef.current = 0;
            crouchingRef.current = true;
            movingSpeed = Math.abs(boatSpeedRef.current);
            applyFishingBoatOarPose({
                delta,
                distance: boatRowDistanceRef.current,
                mounted: true,
                oars: controller.oars,
                rowingAmount: MathUtils.clamp(
                    movingSpeed / fishingBoatForwardSpeed,
                    0,
                    1,
                ),
            });
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
            const previousX = actor.position.x;
            const previousZ = actor.position.z;
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
            let movedX = movement.position.x - previousX;
            let movedZ = movement.position.z - previousZ;
            let moved = Math.hypot(movedX, movedZ);
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

                const cactus = findGardenAvatarCactusContact({
                    position: {
                        x: previousX + desiredX * delta,
                        z: previousZ + desiredZ * delta,
                    },
                    targets: interactionTargets,
                });
                if (
                    cactus &&
                    inputLength > 0.05 &&
                    now - lastCactusBounceAtRef.current >= 0.7
                ) {
                    lastCactusBounceAtRef.current = now;
                    const bounceDirection =
                        getGardenAvatarCactusBounceDirection({
                            attemptedDirection: {
                                x: desiredX,
                                z: desiredZ,
                            },
                            cactus,
                            position: { x: previousX, z: previousZ },
                        });
                    const bounce = resolveGardenAvatarHorizontalMovement({
                        collisionHeight: crouching
                            ? gardenAvatarCrouchingCollisionHeight
                            : gardenAvatarStandingCollisionHeight,
                        deltaX: bounceDirection.x * 0.34,
                        deltaZ: bounceDirection.z * 0.34,
                        position: movement.position,
                        world,
                    });
                    actor.position.x = bounce.position.x;
                    actor.position.z = bounce.position.z;
                    groundYRef.current = bounce.position.y;
                    velocity.set(
                        bounceDirection.x * 3.1,
                        0,
                        bounceDirection.z * 3.1,
                    );
                    verticalVelocityRef.current = 1.55;
                    groundedRef.current = false;
                    jumpsUsedRef.current = Math.max(jumpsUsedRef.current, 1);
                    movedX = actor.position.x - previousX;
                    movedZ = actor.position.z - previousZ;
                    moved = Math.hypot(movedX, movedZ);
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

        if (
            view !== 'overview' &&
            !mountedBoatRef.current &&
            !seatPose &&
            movingSpeed > 0.18
        ) {
            const forward = getGardenAvatarForwardDirection(actor.rotation.y);
            const beachBall = gameStateStore
                .getState()
                .animalPresenceEntries.filter(
                    (entry) =>
                        entry.species === 'BeachBall' &&
                        now - entry.updatedAt <= 0.6,
                )
                .map((entry) => {
                    const dx = entry.position.x - actor.position.x;
                    const dz = entry.position.z - actor.position.z;
                    return {
                        distance: Math.hypot(dx, dz),
                        entry,
                        forwardDot: dx * forward.x + dz * forward.z,
                    };
                })
                .filter(
                    (candidate) =>
                        candidate.distance <=
                            gardenAvatarBeachBallKickDistance &&
                        candidate.forwardDot >= -0.05,
                )
                .sort(
                    (left, right) => left.distance - right.distance,
                )[0]?.entry;
            if (beachBall) {
                const lastKickAt =
                    lastBeachBallKickAtRef.current.get(beachBall.id) ??
                    Number.NEGATIVE_INFINITY;
                if (
                    now - lastKickAt >= 0.9 &&
                    beachBall.id.startsWith('beach-ball:')
                ) {
                    lastBeachBallKickAtRef.current.set(beachBall.id, now);
                    kickBeachBall({
                        direction: forward,
                        targetId: beachBall.id.slice('beach-ball:'.length),
                    });
                }
            }
        }

        gaitAmountRef.current = MathUtils.damp(
            gaitAmountRef.current,
            mountedBoatRef.current || seatPose
                ? 0
                : MathUtils.clamp(movingSpeed / avatarWalkSpeed, 0, 1),
            9,
            delta,
        );
        crouchAmountRef.current = MathUtils.damp(
            crouchAmountRef.current,
            mountedBoatRef.current || seatPose || crouchingRef.current ? 1 : 0,
            18,
            delta,
        );
        zoomingRef.current = mouseZoomingRef.current;
        animateGardenAvatarRig({
            crouchAmount: crouchAmountRef.current,
            delta,
            distanceWalked: distanceWalkedRef.current,
            grounded: groundedRef.current,
            headPitch: view === 'overview' ? 0 : pitchRef.current,
            rig: model.rig,
            seated: Boolean(mountedBoatRef.current || seatPose),
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
        if (now - lastPresenceReportAtRef.current >= 0.1) {
            lastPresenceReportAtRef.current = now;
            const avatarYaw = Math.atan2(
                Math.sin(actor.rotation.y),
                Math.cos(actor.rotation.y),
            );
            if (view !== 'overview') {
                setAvatarPresence({
                    position: {
                        x: actor.position.x,
                        y: actor.position.y,
                        z: actor.position.z,
                    },
                    updatedAt: now,
                    yaw: avatarYaw,
                });
            }
            presenceCallbackRef.current?.({
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
                yaw: avatarYaw,
            });
        }
    });

    return (
        <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js actor enters the playable camera mode. */}
            <group
                ref={actorRef}
                userData={{
                    [blockInteractionPassthroughUserDataKey]: true,
                }}
                onPointerDown={
                    interactionDisabled ? undefined : stopAvatarPointer
                }
                onClick={interactionDisabled ? undefined : enterAvatarView}
                onPointerOver={
                    interactionDisabled ? undefined : showAvatarPointer
                }
                onPointerOut={
                    interactionDisabled ? undefined : hideAvatarPointer
                }
            >
                {!interactionDisabled ? (
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
                ) : null}
                <group scale={avatarModelScale}>
                    <primitive object={model.scene} />
                </group>
                {view === 'overview' &&
                showActivationPrompt &&
                !interactionDisabled ? (
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
            {view === 'overview' && speechMessage && !interactionDisabled ? (
                <ActorSpeechBubble
                    actorRef={actorRef}
                    message={speechMessage}
                    offsetY={avatarSpeechBubbleOffsetY}
                />
            ) : null}
            {collisionDebugVisible ? (
                <GardenAvatarCollisionDebug
                    actorRef={actorRef}
                    crouchingRef={crouchingRef}
                    world={world}
                />
            ) : null}
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
