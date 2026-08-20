import type { Object3D, Vector3 } from 'three';

type AnimalPlacementActor = Pick<Object3D, 'position' | 'rotation'>;

type AnimalHome = {
    facingYaw?: number;
    position: Vector3;
};

export function initializeAnimalAtHome({
    actor,
    home,
    runtimeInitialized,
}: {
    actor: AnimalPlacementActor | null;
    home: AnimalHome;
    runtimeInitialized: boolean;
}) {
    if (!actor || runtimeInitialized) {
        return false;
    }

    actor.position.copy(home.position);
    if (home.facingYaw !== undefined) {
        actor.rotation.y = home.facingYaw;
    }
    return true;
}
