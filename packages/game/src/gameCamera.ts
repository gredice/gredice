export const defaultGameCameraPosition: [x: number, y: number, z: number] = [
    -100, 100, -100,
];

export const defaultGameCameraTarget: [x: number, y: number, z: number] = [
    0, 0, 0,
];

export const defaultGameCameraZoom = 100;
export const farGameCameraZoom = 75;

export const closeupGameCameraZoom = 300;
export const extraSmallCloseupGameCameraZoom = 260;
export const tinyCloseupGameCameraZoom = 240;

export function getCloseupGameCameraZoom({
    height,
    width,
}: {
    height: number;
    width: number;
}) {
    if (width <= 340 || height <= 620) {
        return tinyCloseupGameCameraZoom;
    }

    if (width <= 390 || height <= 700) {
        return extraSmallCloseupGameCameraZoom;
    }

    return closeupGameCameraZoom;
}
