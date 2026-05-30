import type { SyntheticEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_MIN_ZOOM_LEVEL = 0.5;
const MAX_ZOOM_LEVEL = 5;
const FIT_PADDING = 32;

interface Size {
    width: number;
    height: number;
}

function calculateFitZoomLevel(viewerSize: Size, imageSize: Size) {
    const availableWidth = Math.max(viewerSize.width - FIT_PADDING, 1);
    const availableHeight = Math.max(viewerSize.height - FIT_PADDING, 1);
    const fitZoomLevel = Math.min(
        availableWidth / imageSize.width,
        availableHeight / imageSize.height,
        1,
    );

    return Number.isFinite(fitZoomLevel) && fitZoomLevel > 0 ? fitZoomLevel : 1;
}

export function useImageFitZoom<TElement extends HTMLElement = HTMLDivElement>(
    isExpanded: boolean,
    imageKey: string,
) {
    const viewerRef = useRef<TElement>(null);
    const fitZoomLevelRef = useRef(1);
    const [viewerSize, setViewerSize] = useState<Size>({ width: 0, height: 0 });
    const [imageSize, setImageSize] = useState<Size | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    const fitZoomLevel = useMemo(() => {
        if (
            !imageSize ||
            imageSize.width <= 0 ||
            imageSize.height <= 0 ||
            viewerSize.width <= 0 ||
            viewerSize.height <= 0
        ) {
            return 1;
        }

        return calculateFitZoomLevel(viewerSize, imageSize);
    }, [imageSize, viewerSize]);

    const minimumZoomLevel = Math.min(DEFAULT_MIN_ZOOM_LEVEL, fitZoomLevel);

    const clampZoomLevel = useCallback(
        (nextZoomLevel: number) =>
            Math.min(Math.max(nextZoomLevel, minimumZoomLevel), MAX_ZOOM_LEVEL),
        [minimumZoomLevel],
    );

    useEffect(() => {
        fitZoomLevelRef.current = fitZoomLevel;
    }, [fitZoomLevel]);

    const updateViewerSize = useCallback(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const nextSize = {
            width: viewer.clientWidth,
            height: viewer.clientHeight,
        };

        setViewerSize((currentSize) =>
            currentSize.width === nextSize.width &&
            currentSize.height === nextSize.height
                ? currentSize
                : nextSize,
        );

        return nextSize;
    }, []);

    const resetZoomLevel = useCallback(() => {
        setZoomLevel(fitZoomLevelRef.current);
    }, []);

    const handleImageLoad = useCallback(
        (event: SyntheticEvent<HTMLImageElement>) => {
            const nextImageSize = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
            };
            const nextViewerSize = updateViewerSize() ?? viewerSize;

            setImageSize(nextImageSize);
            setZoomLevel(calculateFitZoomLevel(nextViewerSize, nextImageSize));
        },
        [updateViewerSize, viewerSize],
    );

    useEffect(() => {
        if (!imageKey) {
            setImageSize(null);
            resetZoomLevel();
            return;
        }

        setImageSize(null);
        resetZoomLevel();
    }, [imageKey, resetZoomLevel]);

    useEffect(() => {
        if (!isExpanded) return;

        updateViewerSize();

        const viewer = viewerRef.current;
        if (!viewer) return;

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateViewerSize);

            return () => {
                window.removeEventListener('resize', updateViewerSize);
            };
        }

        const resizeObserver = new ResizeObserver(() => {
            updateViewerSize();
        });

        resizeObserver.observe(viewer);
        window.addEventListener('resize', updateViewerSize);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateViewerSize);
        };
    }, [isExpanded, updateViewerSize]);

    useEffect(() => {
        setZoomLevel((currentZoomLevel) => clampZoomLevel(currentZoomLevel));
    }, [clampZoomLevel]);

    useEffect(() => {
        if (!isExpanded || !imageSize) return;

        setZoomLevel(fitZoomLevel);
    }, [fitZoomLevel, imageSize, isExpanded]);

    return {
        clampZoomLevel,
        fitZoomLevel,
        handleImageLoad,
        minimumZoomLevel,
        resetZoomLevel,
        setZoomLevel,
        viewerRef,
        zoomLevel,
    };
}
