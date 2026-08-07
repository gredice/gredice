export type PlantLodLevel = 'near' | 'mid' | 'far';

const NEAR_THRESHOLD = 0.12;
const FAR_THRESHOLD = 0.045;
const HYSTERESIS = 0.012;
const CLOSE_NEAR_ZOOM = 180;
const CLOSE_NEAR_ZOOM_HYSTERESIS = 20;

export function resolvePlantLodLevel(screenOccupancy: number): PlantLodLevel {
    if (screenOccupancy >= NEAR_THRESHOLD) {
        return 'near';
    }

    if (screenOccupancy >= FAR_THRESHOLD) {
        return 'mid';
    }

    return 'far';
}

export function resolvePlantLodLevelWithHysteresis({
    cameraZoom,
    currentLevel,
    nearHysteresis = HYSTERESIS,
    nearThreshold = NEAR_THRESHOLD,
    screenOccupancy,
}: {
    cameraZoom: number;
    currentLevel: PlantLodLevel;
    nearHysteresis?: number;
    nearThreshold?: number;
    screenOccupancy: number;
}): PlantLodLevel {
    if (
        cameraZoom >=
        CLOSE_NEAR_ZOOM -
            (currentLevel === 'near' ? CLOSE_NEAR_ZOOM_HYSTERESIS : 0)
    ) {
        return 'near';
    }

    if (currentLevel === 'near') {
        if (screenOccupancy >= nearThreshold - nearHysteresis) {
            return 'near';
        }
        return screenOccupancy >= FAR_THRESHOLD - HYSTERESIS ? 'mid' : 'far';
    }

    if (currentLevel === 'mid') {
        if (screenOccupancy >= nearThreshold + nearHysteresis) {
            return 'near';
        }
        if (screenOccupancy < FAR_THRESHOLD - HYSTERESIS) {
            return 'far';
        }
        return 'mid';
    }

    if (screenOccupancy >= nearThreshold + nearHysteresis) {
        return 'near';
    }

    return screenOccupancy >= FAR_THRESHOLD + HYSTERESIS ? 'mid' : 'far';
}
