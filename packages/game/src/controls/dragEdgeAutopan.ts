export type DragEdgeAutopanPointer = {
    clientX: number;
    clientY: number;
};

export type DragEdgeAutopanViewport = {
    height: number;
    left: number;
    top: number;
    width: number;
};

export type DragEdgeAutopanDelta = {
    x: number;
    y: number;
};

type DragEdgeAutopanOptions = {
    edgeInsetPx?: number;
    maxFrameDeltaSeconds?: number;
    maxSpeedPxPerSecond?: number;
};

const defaultEdgeInsetPx = 96;
const defaultMaxFrameDeltaSeconds = 0.05;
const defaultMaxSpeedPxPerSecond = 520;
const autopanEpsilon = 0.01;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getEdgeStrength(distanceToEdge: number, edgeInsetPx: number) {
    if (edgeInsetPx <= 0) {
        return 0;
    }

    return 1 - clamp(distanceToEdge / edgeInsetPx, 0, 1);
}

export function getDragEdgeAutopanDelta({
    frameDeltaSeconds,
    pointer,
    viewport,
    edgeInsetPx = defaultEdgeInsetPx,
    maxFrameDeltaSeconds = defaultMaxFrameDeltaSeconds,
    maxSpeedPxPerSecond = defaultMaxSpeedPxPerSecond,
}: {
    frameDeltaSeconds: number;
    pointer: DragEdgeAutopanPointer;
    viewport: DragEdgeAutopanViewport;
} & DragEdgeAutopanOptions): DragEdgeAutopanDelta {
    if (
        frameDeltaSeconds <= 0 ||
        viewport.width <= 0 ||
        viewport.height <= 0 ||
        maxSpeedPxPerSecond <= 0
    ) {
        return { x: 0, y: 0 };
    }

    const xInset = Math.min(edgeInsetPx, viewport.width / 2);
    const yInset = Math.min(edgeInsetPx, viewport.height / 2);
    const frameDelta = Math.min(frameDeltaSeconds, maxFrameDeltaSeconds);
    const frameSpeed = maxSpeedPxPerSecond * frameDelta;

    const leftStrength = getEdgeStrength(
        pointer.clientX - viewport.left,
        xInset,
    );
    const rightStrength = getEdgeStrength(
        viewport.left + viewport.width - pointer.clientX,
        xInset,
    );
    const topStrength = getEdgeStrength(pointer.clientY - viewport.top, yInset);
    const bottomStrength = getEdgeStrength(
        viewport.top + viewport.height - pointer.clientY,
        yInset,
    );

    return {
        x: (leftStrength - rightStrength) * frameSpeed,
        y: (topStrength - bottomStrength) * frameSpeed,
    };
}

export function hasDragEdgeAutopanDelta(delta: DragEdgeAutopanDelta) {
    return (
        Math.abs(delta.x) > autopanEpsilon || Math.abs(delta.y) > autopanEpsilon
    );
}
