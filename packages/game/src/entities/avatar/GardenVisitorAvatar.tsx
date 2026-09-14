import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { type Group, MathUtils, Vector3 } from 'three';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import { useGameState } from '../../useGameState';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import {
    animateGardenAvatarRig,
    avatarModelScale,
    dampGardenAvatarAngle,
    prepareGardenAvatarModel,
} from './GardenAvatar';
import type { GardenVisitorPresence } from './gardenVisitorPresence';

const remotePositionDamping = 9;
const remoteRotationDamping = 12;

export function GardenVisitorAvatar({
    presence,
}: {
    presence: GardenVisitorPresence;
}) {
    const gltf = useGameGLTF('FarmerAvatar');
    const localView = useGameState((state) => state.gardenAvatarView);
    const actorRef = useRef<Group>(null);
    const targetPositionRef = useRef(new Vector3(...presence.position));
    const targetYawRef = useRef(presence.yaw);
    const targetMovingSpeedRef = useRef(presence.movingSpeed);
    const targetCrouchAmountRef = useRef(presence.crouchAmount);
    const targetHeadPitchRef = useRef(presence.headPitch);
    const targetGroundedRef = useRef(presence.grounded);
    const movingSpeedRef = useRef(presence.movingSpeed);
    const crouchAmountRef = useRef(presence.crouchAmount);
    const distanceWalkedRef = useRef(0);
    const model = useMemo(() => {
        const scene = gltf.scene.clone(true);
        return { ...prepareGardenAvatarModel(scene), scene };
    }, [gltf.scene]);
    const castsRealShadow = localView !== 'overview';
    const updateActorGroundingShadow = useActorGroundingShadow({
        id: `garden-visitor-${presence.id}`,
        primaryCasterCount: castsRealShadow ? model.primaryCasterCount : 0,
        species: 'avatar',
    });

    targetPositionRef.current.set(...presence.position);
    targetYawRef.current = presence.yaw;
    targetMovingSpeedRef.current = presence.movingSpeed;
    targetCrouchAmountRef.current = presence.crouchAmount;
    targetHeadPitchRef.current = presence.headPitch;
    targetGroundedRef.current = presence.grounded;

    useSceneTimeInvalidation(
        'visitor-avatar',
        true,
        sceneFrameRates.interactive,
    );

    useLayoutEffect(() => {
        const actor = actorRef.current;
        if (actor) {
            actor.position.copy(targetPositionRef.current);
            actor.rotation.y = targetYawRef.current;
        }
    }, []);

    useLayoutEffect(() => {
        for (const mesh of model.meshes) {
            mesh.castShadow = castsRealShadow;
        }
    }, [castsRealShadow, model.meshes]);

    useLayoutEffect(
        () => () => {
            model.shadowOnlyMaterial.dispose();
        },
        [model.shadowOnlyMaterial],
    );

    useFrame(({ gl }, frameDelta) => {
        const actor = actorRef.current;
        if (!actor) {
            return;
        }

        const delta = Math.min(frameDelta, 0.05);
        const previousX = actor.position.x;
        const previousZ = actor.position.z;
        actor.position.x = MathUtils.damp(
            actor.position.x,
            targetPositionRef.current.x,
            remotePositionDamping,
            delta,
        );
        actor.position.y = MathUtils.damp(
            actor.position.y,
            targetPositionRef.current.y,
            remotePositionDamping,
            delta,
        );
        actor.position.z = MathUtils.damp(
            actor.position.z,
            targetPositionRef.current.z,
            remotePositionDamping,
            delta,
        );
        actor.rotation.y = dampGardenAvatarAngle(
            actor.rotation.y,
            targetYawRef.current,
            remoteRotationDamping,
            delta,
        );

        const moved = Math.hypot(
            actor.position.x - previousX,
            actor.position.z - previousZ,
        );
        distanceWalkedRef.current += moved;
        movingSpeedRef.current = MathUtils.damp(
            movingSpeedRef.current,
            targetMovingSpeedRef.current,
            10,
            delta,
        );
        crouchAmountRef.current = MathUtils.damp(
            crouchAmountRef.current,
            targetCrouchAmountRef.current,
            12,
            delta,
        );
        animateGardenAvatarRig({
            crouchAmount: crouchAmountRef.current,
            delta,
            distanceWalked: distanceWalkedRef.current,
            grounded: targetGroundedRef.current,
            headPitch: targetHeadPitchRef.current,
            rig: model.rig,
            walkAmount: MathUtils.clamp(movingSpeedRef.current / 2.15, 0, 1),
        });

        if (castsRealShadow) {
            gl.shadowMap.needsUpdate = true;
        }
        updateActorGroundingShadow?.({
            actorY: actor.position.y,
            receiverY: actor.position.y,
            visible: !castsRealShadow,
            x: actor.position.x,
            yaw: actor.rotation.y,
            z: actor.position.z,
        });
    });

    return (
        <group ref={actorRef}>
            <group scale={avatarModelScale}>
                <primitive object={model.scene} />
            </group>
        </group>
    );
}
