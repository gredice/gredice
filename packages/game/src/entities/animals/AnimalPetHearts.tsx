import { useFrame } from '@react-three/fiber';
import { type RefObject, useEffect, useMemo, useRef } from 'react';
import {
    type Group,
    type Mesh,
    MeshBasicMaterial,
    Shape,
    ShapeGeometry,
    Vector3,
} from 'three';
import { useGameStateStore } from '../../useGameState';

const heartCount = 4;
const heartBurstSeconds = 1.35;
const heartColors = ['#ff4f87', '#ff78a5', '#ff335f', '#ff9fbd'];

function createHeartGeometry() {
    const shape = new Shape();
    shape.moveTo(0, -0.35);
    shape.bezierCurveTo(-0.58, -0.02, -0.58, 0.42, -0.28, 0.48);
    shape.bezierCurveTo(-0.08, 0.52, 0, 0.34, 0, 0.22);
    shape.bezierCurveTo(0, 0.34, 0.08, 0.52, 0.28, 0.48);
    shape.bezierCurveTo(0.58, 0.42, 0.58, -0.02, 0, -0.35);
    return new ShapeGeometry(shape, 6);
}

export function AnimalPetHearts({
    actorRef,
    offsetY,
    targetId,
}: {
    actorRef: RefObject<Group | null>;
    offsetY: number;
    targetId: string;
}) {
    const gameStateStore = useGameStateStore();
    const groupRef = useRef<Group>(null);
    const heartRefs = useRef<Array<Mesh | null>>([]);
    const burstStartedAtRef = useRef(Number.NEGATIVE_INFINITY);
    const lastRequestSequenceRef = useRef(0);
    const actorWorldPositionRef = useRef(new Vector3());
    const geometry = useMemo(createHeartGeometry, []);
    const materials = useMemo(
        () =>
            heartColors.map(
                (color) =>
                    new MeshBasicMaterial({
                        color,
                        depthWrite: false,
                        opacity: 0,
                        toneMapped: false,
                        transparent: true,
                    }),
            ),
        [],
    );

    useEffect(
        () => () => {
            geometry.dispose();
            for (const material of materials) {
                material.dispose();
            }
        },
        [geometry, materials],
    );

    useFrame(({ camera, clock }) => {
        const actor = actorRef.current;
        const group = groupRef.current;
        if (!actor || !group) {
            return;
        }

        const request = gameStateStore.getState().gardenAvatarAnimalPetRequest;
        if (
            request &&
            request.targetId === targetId &&
            request.sequence !== lastRequestSequenceRef.current
        ) {
            lastRequestSequenceRef.current = request.sequence;
            burstStartedAtRef.current = clock.elapsedTime;
            group.visible = true;
        }

        const elapsed = clock.elapsedTime - burstStartedAtRef.current;
        if (elapsed > heartBurstSeconds) {
            group.visible = false;
            return;
        }

        actor.getWorldPosition(actorWorldPositionRef.current);
        group.position.copy(actorWorldPositionRef.current);
        group.position.y += offsetY;
        group.quaternion.copy(camera.quaternion);

        for (let index = 0; index < heartCount; index += 1) {
            const heart = heartRefs.current[index];
            const material = materials[index];
            if (!heart || !material) {
                continue;
            }
            const progress = Math.min(
                Math.max((elapsed - index * 0.1) / 0.95, 0),
                1,
            );
            const visible = progress > 0 && progress < 1;
            heart.visible = visible;
            if (!visible) {
                continue;
            }

            heart.position.set(
                Math.sin(index * 2.1 + progress * 5.2) * 0.16,
                progress * (0.68 + index * 0.06),
                index * 0.008,
            );
            const scale = 0.14 * (0.72 + Math.sin(progress * Math.PI) * 0.38);
            heart.scale.setScalar(scale);
            material.opacity = Math.min(1, (1 - progress) * 1.8);
        }
    });

    return (
        <group ref={groupRef} visible={false}>
            {materials.map((material, index) => (
                <mesh
                    key={material.uuid}
                    ref={(heart) => {
                        heartRefs.current[index] = heart;
                    }}
                    geometry={geometry}
                    material={material}
                    renderOrder={25}
                />
            ))}
        </group>
    );
}
