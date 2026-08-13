export const defaultGardenAvatarCameraZoom = 1;
export const gardenAvatarCameraZoomStep = 1.15;

const minimumGardenAvatarCameraZoom = 0.75;
const maximumGardenAvatarCameraZoom = 1.6;

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
