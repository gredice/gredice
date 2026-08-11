import { Vector3 } from 'three';

export function getHazelLightArchFootprintCenterOffset(rotation: number) {
    const normalizedRotation = ((Math.round(rotation) % 2) + 2) % 2;

    return normalizedRotation === 1
        ? new Vector3(0.5, 0, 0)
        : new Vector3(0, 0, 0.5);
}
