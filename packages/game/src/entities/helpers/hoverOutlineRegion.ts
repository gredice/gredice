export const hoverOutlineAllocationBucketPixels = 32;
export const hoverOutlineCropGuardPixels = 2;

export type HoverOutlineNormalizedBounds = {
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
};

export type HoverOutlineRegion = {
    allocationCapacity: {
        height: number;
        pixels: number;
        width: number;
    };
    areaRatios: {
        allocationToDrawingBuffer: number;
        cropToAllocation: number;
        cropToDrawingBuffer: number;
    };
    clipping: {
        any: boolean;
        bottom: boolean;
        left: boolean;
        right: boolean;
        top: boolean;
    };
    crop: {
        height: number;
        maxX: number;
        maxY: number;
        width: number;
        x: number;
        y: number;
    };
    drawingBuffer: {
        height: number;
        pixels: number;
        width: number;
    };
    paddingPixels: number;
};

function clampUnit(value: number) {
    return Math.min(1, Math.max(0, value));
}

function resolveBucketCapacity(
    requiredPixels: number,
    availablePixels: number,
    bucketPixels: number,
) {
    return Math.min(
        availablePixels,
        Math.ceil(requiredPixels / bucketPixels) * bucketPixels,
    );
}

export function resolveHoverOutlineRegion({
    allocationBucketPixels = hoverOutlineAllocationBucketPixels,
    bounds,
    drawingBufferHeight,
    drawingBufferWidth,
    thickness,
}: {
    allocationBucketPixels?: number;
    bounds: HoverOutlineNormalizedBounds;
    drawingBufferHeight: number;
    drawingBufferWidth: number;
    thickness: number;
}): HoverOutlineRegion | null {
    if (
        !Number.isFinite(bounds.maxX) ||
        !Number.isFinite(bounds.maxY) ||
        !Number.isFinite(bounds.minX) ||
        !Number.isFinite(bounds.minY) ||
        !Number.isFinite(drawingBufferHeight) ||
        !Number.isFinite(drawingBufferWidth) ||
        !Number.isFinite(thickness) ||
        !Number.isFinite(allocationBucketPixels) ||
        bounds.minX >= bounds.maxX ||
        bounds.minY >= bounds.maxY ||
        drawingBufferHeight < 1 ||
        drawingBufferWidth < 1 ||
        thickness < 0 ||
        allocationBucketPixels < 1
    ) {
        return null;
    }

    if (
        bounds.maxX <= 0 ||
        bounds.maxY <= 0 ||
        bounds.minX >= 1 ||
        bounds.minY >= 1
    ) {
        return null;
    }

    const bufferWidth = Math.floor(drawingBufferWidth);
    const bufferHeight = Math.floor(drawingBufferHeight);
    const bucketPixels = Math.floor(allocationBucketPixels);
    if (bufferWidth < 1 || bufferHeight < 1 || bucketPixels < 1) {
        return null;
    }

    const paddingPixels = Math.ceil(thickness) + hoverOutlineCropGuardPixels;
    const rawMinX = Math.floor(clampUnit(bounds.minX) * bufferWidth);
    const rawMinY = Math.floor(clampUnit(bounds.minY) * bufferHeight);
    const rawMaxX = Math.ceil(clampUnit(bounds.maxX) * bufferWidth);
    const rawMaxY = Math.ceil(clampUnit(bounds.maxY) * bufferHeight);
    const paddedMinX = rawMinX - paddingPixels;
    const paddedMinY = rawMinY - paddingPixels;
    const paddedMaxX = rawMaxX + paddingPixels;
    const paddedMaxY = rawMaxY + paddingPixels;
    const minX = Math.max(0, paddedMinX);
    const minY = Math.max(0, paddedMinY);
    const maxX = Math.min(bufferWidth, paddedMaxX);
    const maxY = Math.min(bufferHeight, paddedMaxY);

    if (minX >= maxX || minY >= maxY) {
        return null;
    }

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;
    const capacityWidth = resolveBucketCapacity(
        cropWidth,
        bufferWidth,
        bucketPixels,
    );
    const capacityHeight = resolveBucketCapacity(
        cropHeight,
        bufferHeight,
        bucketPixels,
    );
    const cropPixels = cropWidth * cropHeight;
    const capacityPixels = capacityWidth * capacityHeight;
    const drawingBufferPixels = bufferWidth * bufferHeight;
    const clipping = {
        bottom: paddedMinY < 0 || bounds.minY < 0,
        left: paddedMinX < 0 || bounds.minX < 0,
        right: paddedMaxX > bufferWidth || bounds.maxX > 1,
        top: paddedMaxY > bufferHeight || bounds.maxY > 1,
    };

    return {
        allocationCapacity: {
            height: capacityHeight,
            pixels: capacityPixels,
            width: capacityWidth,
        },
        areaRatios: {
            allocationToDrawingBuffer: capacityPixels / drawingBufferPixels,
            cropToAllocation: cropPixels / capacityPixels,
            cropToDrawingBuffer: cropPixels / drawingBufferPixels,
        },
        clipping: {
            ...clipping,
            any:
                clipping.bottom ||
                clipping.left ||
                clipping.right ||
                clipping.top,
        },
        crop: {
            height: cropHeight,
            maxX,
            maxY,
            width: cropWidth,
            x: minX,
            y: minY,
        },
        drawingBuffer: {
            height: bufferHeight,
            pixels: drawingBufferPixels,
            width: bufferWidth,
        },
        paddingPixels,
    };
}
