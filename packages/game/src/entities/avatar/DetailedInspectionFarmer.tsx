import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
    type MouseEvent as ReactMouseEvent,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import type { Group } from 'three';
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
    prepareGardenAvatarModel,
} from './GardenAvatar';

const inspectionFarmerSpeechOffsetY = 1.85;

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

    useSceneTimeInvalidation(true, sceneFrameRates.interactive);

    useLayoutEffect(() => {
        for (const mesh of model.meshes) {
            mesh.castShadow = castsRealShadow;
        }
        gl.shadowMap.needsUpdate = true;
    }, [castsRealShadow, gl, model.meshes]);

    useEffect(
        () => () => {
            model.shadowOnlyMaterial.dispose();
            gl.domElement.style.cursor = 'auto';
        },
        [gl.domElement, model.shadowOnlyMaterial],
    );

    useFrame(({ clock, gl: frameGl }, delta) => {
        const actor = actorRef.current;
        if (!actor) {
            return;
        }

        animateGardenAvatarRig({
            crouchAmount: 0,
            delta: Math.min(delta, 0.05),
            distanceWalked: 0,
            grounded: true,
            headPitch: Math.sin(clock.elapsedTime * 0.7) * 0.035,
            rig: model.rig,
            walkAmount: 0,
        });
        if (castsRealShadow) {
            frameGl.shadowMap.needsUpdate = true;
        }
        updateActorGroundingShadow?.({
            actorY: actor.position.y,
            receiverY: transform.position[1],
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
            />
        </>
    );
}
