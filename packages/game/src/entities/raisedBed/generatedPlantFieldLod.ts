import * as THREE from 'three';
import {
    type PlantLodLevel,
    resolvePlantLodLevelWithHysteresis,
} from '../../generators/plant/lib/plantLod';

const FIELD_HORIZONTAL_BOUNDS_MARGIN = 0.4;
const MINIMUM_PLANT_HEIGHT = 0.25;

export type GeneratedPlantFieldBoundsInput = {
    approximatePlantHeight: number;
    position: readonly [number, number, number];
};

export function getGeneratedPlantBatchKey({
    focused,
    lodLevel,
    plantType,
    raisedBedId,
}: {
    focused: boolean;
    lodLevel: PlantLodLevel;
    plantType: string;
    raisedBedId: number;
}) {
    return focused
        ? `${plantType}:${lodLevel}:focus:${raisedBedId}`
        : `${plantType}:${lodLevel}:background`;
}

export function resolveGeneratedPlantFieldLod({
    cameraZoom,
    currentLevel,
    focusActive,
    isSelectedRaisedBed,
    screenOccupancy,
}: {
    cameraZoom: number;
    currentLevel: PlantLodLevel;
    focusActive: boolean;
    isSelectedRaisedBed: boolean;
    screenOccupancy: number;
}): PlantLodLevel {
    if (focusActive && isSelectedRaisedBed) {
        return 'near';
    }

    const resolvedLevel = resolvePlantLodLevelWithHysteresis({
        cameraZoom,
        currentLevel,
        screenOccupancy,
    });

    if (focusActive && resolvedLevel === 'near') {
        return 'mid';
    }

    return resolvedLevel;
}

export function buildGeneratedPlantRaisedBedBounds(
    fields: readonly GeneratedPlantFieldBoundsInput[],
) {
    const bounds = new THREE.Box3();

    for (const field of fields) {
        const [x, y, z] = field.position;
        const height = Math.max(
            field.approximatePlantHeight,
            MINIMUM_PLANT_HEIGHT,
        );

        bounds.expandByPoint(
            new THREE.Vector3(
                x - FIELD_HORIZONTAL_BOUNDS_MARGIN,
                y,
                z - FIELD_HORIZONTAL_BOUNDS_MARGIN,
            ),
        );
        bounds.expandByPoint(
            new THREE.Vector3(
                x + FIELD_HORIZONTAL_BOUNDS_MARGIN,
                y + height,
                z + FIELD_HORIZONTAL_BOUNDS_MARGIN,
            ),
        );
    }

    if (bounds.isEmpty()) {
        return new THREE.Sphere();
    }

    return bounds.getBoundingSphere(new THREE.Sphere());
}

export function isGeneratedPlantRaisedBedGroupVisible({
    bounds,
    focusActive,
    frustum,
    isSelectedRaisedBed,
}: {
    bounds: THREE.Sphere;
    focusActive: boolean;
    frustum: THREE.Frustum;
    isSelectedRaisedBed: boolean;
}) {
    return (
        (focusActive && isSelectedRaisedBed) || frustum.intersectsSphere(bounds)
    );
}
