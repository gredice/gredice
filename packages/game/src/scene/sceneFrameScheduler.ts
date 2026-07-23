export const maximumSceneFramesPerSecond = 60;

const sceneFrameToleranceMs = 0.5;

export function normalizeSceneFramesPerSecond(framesPerSecond: number) {
    if (!Number.isFinite(framesPerSecond) || framesPerSecond <= 0) {
        return 0;
    }

    return Math.min(maximumSceneFramesPerSecond, Math.max(1, framesPerSecond));
}

export function resolveSceneFramesPerSecond(
    baseFramesPerSecond: number,
    leaseFrameRates: Iterable<number>,
) {
    let resolvedFramesPerSecond =
        normalizeSceneFramesPerSecond(baseFramesPerSecond);

    for (const leaseFrameRate of leaseFrameRates) {
        resolvedFramesPerSecond = Math.max(
            resolvedFramesPerSecond,
            normalizeSceneFramesPerSecond(leaseFrameRate),
        );
    }

    return resolvedFramesPerSecond;
}

export function resolveSceneVisibility({
    canvasVisible,
    documentVisible,
    suspendWhenOffscreen,
}: {
    canvasVisible: boolean;
    documentVisible: boolean;
    suspendWhenOffscreen: boolean;
}) {
    return documentVisible && (!suspendWhenOffscreen || canvasVisible);
}

export function resolveSceneFrameTick({
    framesPerSecond,
    lastFrameTimestamp,
    timestamp,
}: {
    framesPerSecond: number;
    lastFrameTimestamp: number | null;
    timestamp: number;
}) {
    const normalizedFramesPerSecond =
        normalizeSceneFramesPerSecond(framesPerSecond);
    if (normalizedFramesPerSecond === 0) {
        return {
            lastFrameTimestamp,
            shouldRender: false,
        };
    }

    const frameIntervalMs = 1000 / normalizedFramesPerSecond;
    const shouldRender =
        lastFrameTimestamp === null ||
        timestamp - lastFrameTimestamp >=
            frameIntervalMs - sceneFrameToleranceMs;

    return {
        lastFrameTimestamp: shouldRender ? timestamp : lastFrameTimestamp,
        shouldRender,
    };
}
