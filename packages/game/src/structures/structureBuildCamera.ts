type GardenStructureBuildViewport = Readonly<{
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}>;

type Vector3Tuple = readonly [x: number, y: number, z: number];

export type GardenStructureBuildCameraFrame = Readonly<{
    zoom: number;
    screenPosition: Readonly<{ x: number; y: number }>;
    visibleViewport: GardenStructureBuildViewport;
    projectedWidth: number;
    projectedHeight: number;
}>;

export const gardenStructureBuildMinimumZoom = 8;
const projectedMarginWorldUnits = 1.2;

function vectorLength([x, y, z]: Vector3Tuple) {
    return Math.hypot(x, y, z);
}

function normalize(vector: Vector3Tuple): Vector3Tuple {
    const length = vectorLength(vector);
    return length > 0
        ? [vector[0] / length, vector[1] / length, vector[2] / length]
        : [0, 0, 0];
}

function cross(
    [leftX, leftY, leftZ]: Vector3Tuple,
    [rightX, rightY, rightZ]: Vector3Tuple,
): Vector3Tuple {
    return [
        leftY * rightZ - leftZ * rightY,
        leftZ * rightX - leftX * rightZ,
        leftX * rightY - leftY * rightX,
    ];
}

function resolveVisibleViewport(
    viewportWidth: number,
    viewportHeight: number,
): GardenStructureBuildViewport {
    const landscape = viewportWidth > viewportHeight;
    const left = viewportWidth * (landscape ? 0.48 : 0.07);
    const right = viewportWidth * (landscape ? 1 : 0.93);
    const top = viewportHeight * (landscape ? 0.15 : 0.08);
    const bottom = viewportHeight * (landscape ? 0.9 : 0.46);
    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
    };
}

function resolveCameraAxes(cameraOffset: Vector3Tuple) {
    const forward = normalize([
        -cameraOffset[0],
        -cameraOffset[1],
        -cameraOffset[2],
    ]);
    let right = normalize(cross(forward, [0, 1, 0]));
    if (vectorLength(right) === 0) {
        right = [1, 0, 0];
    }
    const up = normalize(cross(right, forward));
    return { right, up };
}

function projectedAxisAlignedExtent({
    axis,
    width,
    height,
    depth,
}: {
    axis: Vector3Tuple;
    width: number;
    height: number;
    depth: number;
}) {
    return (
        Math.abs(axis[0]) * width +
        Math.abs(axis[1]) * height +
        Math.abs(axis[2]) * depth
    );
}

export function resolveGardenStructureBuildCameraFrame({
    cameraOffset,
    depth,
    height,
    viewportHeight,
    viewportWidth,
    width,
}: {
    cameraOffset: Vector3Tuple;
    depth: number;
    height: number;
    viewportHeight: number;
    viewportWidth: number;
    width: number;
}): GardenStructureBuildCameraFrame {
    const visibleViewport = resolveVisibleViewport(
        viewportWidth,
        viewportHeight,
    );
    const fallback = {
        zoom: 50,
        screenPosition: { x: 0.5, y: 0.5 },
        visibleViewport,
        projectedWidth: 0,
        projectedHeight: 0,
    };
    if (
        !Number.isFinite(width) ||
        !Number.isFinite(depth) ||
        !Number.isFinite(height) ||
        !Number.isFinite(viewportWidth) ||
        !Number.isFinite(viewportHeight) ||
        width <= 0 ||
        depth <= 0 ||
        height < 0 ||
        viewportWidth <= 0 ||
        viewportHeight <= 0 ||
        vectorLength(cameraOffset) === 0
    ) {
        return fallback;
    }

    const { right, up } = resolveCameraAxes(cameraOffset);
    const projectedWidth = projectedAxisAlignedExtent({
        axis: right,
        width,
        height,
        depth,
    });
    const projectedHeight = projectedAxisAlignedExtent({
        axis: up,
        width,
        height,
        depth,
    });
    const zoom = Math.max(
        gardenStructureBuildMinimumZoom,
        Math.min(
            visibleViewport.width /
                (projectedWidth + projectedMarginWorldUnits),
            visibleViewport.height /
                (projectedHeight + projectedMarginWorldUnits),
        ),
    );

    return {
        zoom,
        screenPosition: {
            x:
                (visibleViewport.left + visibleViewport.right) /
                2 /
                viewportWidth,
            y:
                (visibleViewport.top + visibleViewport.bottom) /
                2 /
                viewportHeight,
        },
        visibleViewport,
        projectedWidth,
        projectedHeight,
    };
}
