export type BlockSnapshotCameraView = 'default' | 'orthographic';

const reversedStandardSnapshotEntities = new Set([
    'BirdHouse',
    'ChickenCoop',
    'DogHouse',
    'PigletPen',
]);

type GridSpan = {
    depth: number;
    width: number;
};

type OrthographicSnapshotCameraOptions = {
    frontRotation?: number;
    height: number;
    itemPosition?: [number, number, number];
    rotation: number;
    span: GridSpan;
};

export type OrthographicSnapshotCamera = {
    cameraPosition: [number, number, number];
    cameraTarget: [number, number, number];
    cameraUp: [number, number, number];
    label: 'front' | 'right' | 'back' | 'left';
};

export function parseBlockSnapshotCameraView(
    value: string | undefined,
): BlockSnapshotCameraView {
    if (value === undefined) {
        return 'default';
    }

    if (value === 'orthographic') {
        return value;
    }

    throw new Error(
        'BLOCK_SNAPSHOT_CAMERA_VIEW must be unset or "orthographic".',
    );
}

export function getStandardBlockSnapshotBaseRotation(entityName: string) {
    return reversedStandardSnapshotEntities.has(entityName) ? 2 : 0;
}

function getOrthographicViewLabel(
    rotation: number,
    frontRotation = 0,
): OrthographicSnapshotCamera['label'] {
    const normalizedRotation = (((rotation - frontRotation) % 4) + 4) % 4;
    switch (normalizedRotation) {
        case 0:
            return 'front';
        case 1:
            return 'right';
        case 2:
            return 'back';
        default:
            return 'left';
    }
}

export function getOrthographicSnapshotCamera({
    frontRotation,
    height,
    itemPosition = [0.5, 0, 0.5],
    rotation,
    span,
}: OrthographicSnapshotCameraOptions): OrthographicSnapshotCamera {
    const cameraTarget: [number, number, number] = [
        itemPosition[0] + (span.width - 1) / 2,
        height * 0.45,
        itemPosition[2] + (span.depth - 1) / 2,
    ];

    return {
        // Keep the camera fixed while EntityViewer applies the quarter-turn.
        // Moving both would cancel the rotation and produce four identical views.
        cameraPosition: [
            cameraTarget[0],
            cameraTarget[1],
            cameraTarget[2] + 100,
        ],
        cameraTarget,
        cameraUp: [0, 1, 0],
        label: getOrthographicViewLabel(rotation, frontRotation),
    };
}
