import { getImageProps } from 'next/image';

export type HudImagePreload = {
    height: number;
    src: string;
    width: number;
};

const completedPreloads = new Set<string>();
const inFlightPreloads = new Map<string, HTMLImageElement>();
const idlePreloadTimeoutMs = 1500;
const fallbackPreloadDelayMs = 400;

function getPreloadKey(image: HudImagePreload) {
    return `${image.src}:${image.width.toString()}x${image.height.toString()}`;
}

export function preloadHudImages(images: HudImagePreload[]) {
    for (const image of images) {
        const key = getPreloadKey(image);
        if (completedPreloads.has(key) || inFlightPreloads.has(key)) {
            continue;
        }

        const {
            props: { sizes, src, srcSet },
        } = getImageProps({
            alt: '',
            height: image.height,
            src: image.src,
            width: image.width,
        });
        const preloader = new window.Image();
        const markComplete = () => {
            inFlightPreloads.delete(key);
            completedPreloads.add(key);
        };
        const markFailed = () => {
            inFlightPreloads.delete(key);
        };

        inFlightPreloads.set(key, preloader);
        preloader.addEventListener('load', markComplete, { once: true });
        preloader.addEventListener('error', markFailed, { once: true });
        preloader.decoding = 'async';
        preloader.fetchPriority = 'low';
        if (sizes) {
            preloader.sizes = sizes;
        }
        if (srcSet) {
            preloader.srcset = srcSet;
        }
        preloader.src = src;
    }
}

export function scheduleHudImagePreload(images: HudImagePreload[]) {
    if (images.length === 0) {
        return;
    }

    if (typeof window.requestIdleCallback === 'function') {
        const idleCallbackId = window.requestIdleCallback(
            () => preloadHudImages(images),
            { timeout: idlePreloadTimeoutMs },
        );
        return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = window.setTimeout(
        () => preloadHudImages(images),
        fallbackPreloadDelayMs,
    );
    return () => window.clearTimeout(timeoutId);
}
