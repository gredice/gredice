export const defaultGardenAvatarCameraZoom = 1;
export const gardenAvatarCameraZoomStep = 1.15;

const minimumGardenAvatarCameraZoom = 0.75;
const maximumGardenAvatarCameraZoom = 1.6;
const wheelLineHeightPixels = 16;
const fallbackWheelPageHeightPixels = 800;
const wheelDeltaLineMode = 1;
const wheelDeltaPageMode = 2;

export function normalizeGardenAvatarWheelDeltaY({
    deltaMode,
    deltaY,
    pageHeight,
}: {
    deltaMode: number;
    deltaY: number;
    pageHeight: number;
}) {
    if (!Number.isFinite(deltaY)) {
        return 0;
    }

    if (deltaMode === wheelDeltaLineMode) {
        return deltaY * wheelLineHeightPixels;
    }
    if (deltaMode === wheelDeltaPageMode) {
        const safePageHeight =
            Number.isFinite(pageHeight) && pageHeight > 0
                ? pageHeight
                : fallbackWheelPageHeightPixels;
        return deltaY * safePageHeight;
    }

    return deltaY;
}

export function scaleGardenAvatarCameraZoom(
    currentZoom: number,
    scale: number,
) {
    const safeCurrentZoom = Number.isFinite(currentZoom)
        ? currentZoom
        : defaultGardenAvatarCameraZoom;
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

    return Math.min(
        Math.max(safeCurrentZoom * safeScale, minimumGardenAvatarCameraZoom),
        maximumGardenAvatarCameraZoom,
    );
}

export function getGardenAvatarCameraFov({
    defaultFov,
    zoom,
}: {
    defaultFov: number;
    zoom: number;
}) {
    return defaultFov / scaleGardenAvatarCameraZoom(zoom, 1);
}
