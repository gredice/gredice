type CaptureViewBounds = {
    bottom: number;
    left: number;
    right: number;
    top: number;
};

export function resolveCaptureCameraZoom({
    bounds,
    cameraHeight,
    cameraWidth,
    padding,
}: {
    bounds: CaptureViewBounds;
    cameraHeight: number;
    cameraWidth: number;
    padding: number;
}) {
    const halfWidth = Math.max(Math.abs(bounds.left), Math.abs(bounds.right));
    const halfHeight = Math.max(Math.abs(bounds.bottom), Math.abs(bounds.top));
    if (halfWidth <= 0 || halfHeight <= 0) {
        return null;
    }

    return Math.min(
        (cameraWidth * 0.5 * padding) / halfWidth,
        (cameraHeight * 0.5 * padding) / halfHeight,
    );
}
