import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
    type MouseEvent as ReactMouseEvent,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import type { Group } from 'three';
import { MathUtils } from 'three';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import { useGameState } from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import { ActorSpeechBubble } from '../animals/ActorSpeechBubble';
import type { DetailedInspectionFarmerTransform } from './detailedInspectionFarmerPosition';
import {
    animateGardenAvatarRig,
    avatarModelScale,
    dampGardenAvatarAngle,
    prepareGardenAvatarModel,
} from './GardenAvatar';
import { resolveGardenAvatarHorizontalMovement } from './gardenAvatarMovement';

const inspectionFarmerSpeechOffsetY = 1.85;
const inspectionFarmerWalkSpeed = 0.42;
const inspectionFarmerTurnDamping = 14;
const inspectionFarmerGroundDamping = 20;

export function DetailedInspectionFarmer({
    id,
    message,
    onOpen,
    transform,
}: {
    id: string;
    message: string;
    onOpen: () => void;
    transform: DetailedInspectionFarmerTransform;
}) {
    const gltf = useGameGLTF('FarmerAvatar');
    const localAvatarView = useGameState((state) => state.gardenAvatarView);
    const actorRef = useRef<Group>(null);
    const distanceWalkedRef = useRef(0);
    const groundYRef = useRef(transform.position[1]);
    const patrolIndexRef = useRef(transform.patrolRoute.length > 1 ? 1 : 0);
    const walkAmountRef = useRef(0);
    const { gl } = useThree();
    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        return { ...prepareGardenAvatarModel(scene), scene };
    }, [gltf.scene]);
    const castsRealShadow = localAvatarView !== 'overview';
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: `detailed-inspection-farmer-${id}`,
        primaryCasterCount: castsRealShadow ? model.primaryCasterCount : 0,
        species: 'avatar',
    });

    useSceneTimeInvalidation(
        'detailed-inspection-farmer',
        true,
        sceneFrameRates.interactive,
    );

    useLayoutEffect(() => {
        for (const mesh of model.meshes) {
            mesh.castShadow = castsRealShadow;
        }
        gl.shadowMap.needsUpdate = true;
    }, [castsRealShadow, gl, model.meshes]);

    useLayoutEffect(() => {
        const actor = actorRef.current;
        if (!actor) {
            return;
        }

        actor.position.set(...transform.position);
        actor.rotation.y = transform.rotationY;
        distanceWalkedRef.current = 0;
        groundYRef.current = transform.position[1];
        patrolIndexRef.current = transform.patrolRoute.length > 1 ? 1 : 0;
        walkAmountRef.current = 0;
    }, [transform]);

    useEffect(
        () => () => {
            model.shadowOnlyMaterial.dispose();
            gl.domElement.style.cursor = 'auto';
        },
        [gl.domElement, model.shadowOnlyMaterial],
    );

    useFrame(({ clock, gl: frameGl }, frameDelta) => {
        const actor = actorRef.current;
        if (!actor) {
            return;
        }

        const delta = Math.min(frameDelta, 0.05);
        const route = transform.patrolRoute;
        let movingSpeed = 0;
        const target = route[patrolIndexRef.current];
        if (route.length > 1 && target) {
            const dx = target.x - actor.position.x;
            const dz = target.z - actor.position.z;
            const distance = Math.hypot(dx, dz);
            if (distance <= 0.04) {
                patrolIndexRef.current =
                    (patrolIndexRef.current + 1) % route.length;
            } else {
                const travel = Math.min(
                    distance,
                    inspectionFarmerWalkSpeed * delta,
                );
                const movement = resolveGardenAvatarHorizontalMovement({
                    deltaX: (dx / distance) * travel,
                    deltaZ: (dz / distance) * travel,
                    position: {
                        x: actor.position.x,
                        y: groundYRef.current,
                        z: actor.position.z,
                    },
                    world: transform.world,
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
                    inspectionFarmerTurnDamping,
                    delta,
                );
                movingSpeed = moved / Math.max(delta, 0.001);
                distanceWalkedRef.current += moved;
                if (movement.collided && moved < 0.002) {
                    patrolIndexRef.current =
                        (patrolIndexRef.current + 1) % route.length;
                }
            }
        }
        actor.position.y = MathUtils.damp(
            actor.position.y,
            groundYRef.current,
            inspectionFarmerGroundDamping,
            delta,
        );
        walkAmountRef.current = MathUtils.damp(
            walkAmountRef.current,
            movingSpeed > 0.02 ? 1 : 0,
            8,
            delta,
        );

        animateGardenAvatarRig({
            crouchAmount: 0,
            delta,
            distanceWalked: distanceWalkedRef.current,
            grounded: true,
            headPitch: Math.sin(clock.elapsedTime * 0.7) * 0.035,
            rig: model.rig,
            walkAmount: walkAmountRef.current,
        });
        if (castsRealShadow) {
            frameGl.shadowMap.needsUpdate = true;
        }
        updateActorGroundingShadow?.({
            actorY: actor.position.y,
            receiverY: groundYRef.current,
            visible: !castsRealShadow,
            x: actor.position.x,
            yaw: actor.rotation.y,
            z: actor.position.z,
        });
    });

    function handleOpen(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        onOpen();
    }

    function handleBubbleOpen(event: ReactMouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        onOpen();
    }

    function handlePointerOver(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        gl.domElement.style.cursor = 'pointer';
    }

    function handlePointerOut(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        gl.domElement.style.cursor = 'auto';
    }

    return (
        <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js actor opens the inspection notes modal. */}
            <group
                ref={actorRef}
                name="DetailedInspectionFarmer"
                position={transform.position}
                rotation={[0, transform.rotationY, 0]}
                onClick={handleOpen}
                onPointerOut={handlePointerOut}
                onPointerOver={handlePointerOver}
            >
                <mesh
                    name="Interaction:DetailedInspectionFarmer"
                    position={[0, 0.6, 0]}
                    scale={[0.76, 1.32, 0.76]}
                >
                    <boxGeometry />
                    <meshBasicMaterial
                        colorWrite={false}
                        depthWrite={false}
                        opacity={0}
                        transparent
                    />
                </mesh>
                <group scale={avatarModelScale}>
                    <primitive object={model.scene} />
                </group>
            </group>
            <ActorSpeechBubble
                actionLabel="Otvori bilješke detaljnog pregleda gredica"
                actorRef={actorRef}
                message={message}
                offsetY={inspectionFarmerSpeechOffsetY}
                onClick={handleBubbleOpen}
                wide
            />
        </>
    );
}
