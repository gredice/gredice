import { useFrame } from '@react-three/fiber';
import { type RefObject, useMemo, useRef } from 'react';
import type { Group } from 'three';
import {
    type GardenAvatarCollisionWorld,
    gardenAvatarCrouchingCollisionHeight,
    gardenAvatarRadius,
    gardenAvatarStandingCollisionHeight,
} from './gardenAvatarMovement';

export function GardenAvatarCollisionDebug({
    actorRef,
    crouchingRef,
    world,
}: {
    actorRef: RefObject<Group | null>;
    crouchingRef: RefObject<boolean>;
    world: GardenAvatarCollisionWorld;
}) {
    const playerColliderRef = useRef<Group>(null);
    const boxes = useMemo(
        () =>
            world.surfaces.map((surface, index) => {
                const bottomY = surface.bottomY ?? 0;
                const height = Math.max(0.01, surface.y - bottomY);
                return {
                    color:
                        surface.kind === 'water'
                            ? '#38bdf8'
                            : surface.roamable === false
                              ? '#fb923c'
                              : '#84cc16',
                    depth: (surface.halfDepth ?? 0.5) * 2,
                    height,
                    key: `${surface.debugLabel ?? surface.kind}:${index}`,
                    rotation: surface.rotation ?? 0,
                    width: (surface.halfWidth ?? 0.5) * 2,
                    x: surface.x,
                    y: bottomY + height / 2,
                    z: surface.z,
                };
            }),
        [world],
    );

    useFrame(() => {
        const actor = actorRef.current;
        const playerCollider = playerColliderRef.current;
        if (!actor || !playerCollider) {
            return;
        }

        const height = crouchingRef.current
            ? gardenAvatarCrouchingCollisionHeight
            : gardenAvatarStandingCollisionHeight;
        playerCollider.visible = actor.visible;
        playerCollider.position.set(
            actor.position.x,
            actor.position.y + height / 2,
            actor.position.z,
        );
        playerCollider.scale.set(1, height, 1);
    });

    return (
        <>
            {boxes.map((box) => (
                <mesh
                    key={box.key}
                    position={[box.x, box.y, box.z]}
                    rotation={[0, box.rotation, 0]}
                    scale={[box.width, box.height, box.depth]}
                    raycast={() => undefined}
                    renderOrder={10_000}
                >
                    <boxGeometry />
                    <meshBasicMaterial
                        color={box.color}
                        depthTest={false}
                        transparent
                        opacity={0.7}
                        wireframe
                    />
                </mesh>
            ))}
            <group ref={playerColliderRef}>
                <mesh raycast={() => undefined} renderOrder={10_001}>
                    <cylinderGeometry
                        args={[gardenAvatarRadius, gardenAvatarRadius, 1, 16]}
                    />
                    <meshBasicMaterial
                        color="#e879f9"
                        depthTest={false}
                        transparent
                        opacity={0.9}
                        wireframe
                    />
                </mesh>
            </group>
        </>
    );
}
