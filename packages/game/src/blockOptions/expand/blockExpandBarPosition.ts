import { type RefObject, useLayoutEffect, useState } from 'react';

/**
 * The bottom HUD regions of `GameHud` that stay live when no Expand is open.
 * Below the `md` breakpoint the controls row sits above the items row, so a
 * bar placed just above the items would cover live buttons.
 */
export const blockExpandBarBottomHudSelectors = [
    '[data-game-hud-bottom-controls]',
    '[data-game-hud-bottom-items]',
    '[data-game-hud-bottom-right]',
] as const;

/** Space between the bar and the HUD below it, in px. */
export const blockExpandBarHudGap = 8;

export type BlockExpandBarRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

/**
 * The bar's CSS `bottom` (px from the bottom of its containing block) that
 * keeps it `gap` above every HUD box it would overlap horizontally. Boxes
 * outside the container (the close-up view slides the rows away) do not
 * count. Null when nothing is in the way, so the default offset applies.
 */
export function resolveBlockExpandBarBottom({
    bar,
    container,
    obstacles,
    gap = blockExpandBarHudGap,
}: {
    bar: Pick<BlockExpandBarRect, 'left' | 'right'>;
    container: Pick<BlockExpandBarRect, 'top' | 'bottom'>;
    obstacles: readonly BlockExpandBarRect[];
    gap?: number;
}): number | null {
    let top = Number.POSITIVE_INFINITY;
    for (const obstacle of obstacles) {
        const overlapsHorizontally =
            obstacle.right > bar.left && obstacle.left < bar.right;
        const onScreen =
            obstacle.top < container.bottom && obstacle.bottom > container.top;
        if (overlapsHorizontally && onScreen) {
            top = Math.min(top, obstacle.top);
        }
    }

    return Number.isFinite(top)
        ? Math.max(0, Math.round(container.bottom - top + gap))
        : null;
}

/**
 * How far a region's running entrance animation (`animate-in`, a
 * `transform`) still shifts it down. The close-up view slides the rows away
 * with the separate `translate` property, which is not discounted.
 */
function readEntranceOffsetY(element: Element) {
    const { transform } = getComputedStyle(element);
    if (!transform || transform === 'none') {
        return 0;
    }
    try {
        return new DOMMatrixReadOnly(transform).m42;
    } catch {
        return 0;
    }
}

/**
 * Visible boxes inside the live (not inert) bottom HUD regions, where they
 * come to rest after their entrance animation.
 */
function measureLiveBottomHud(root: ParentNode) {
    const rects: BlockExpandBarRect[] = [];
    for (const selector of blockExpandBarBottomHudSelectors) {
        const region = root.querySelector(selector);
        if (!region || region.closest('[inert]')) {
            continue;
        }

        const offsetY = readEntranceOffsetY(region);
        for (const child of region.children) {
            const rect = child.getBoundingClientRect();
            if (rect.width > 1 && rect.height > 1) {
                rects.push({
                    left: rect.left,
                    top: rect.top - offsetY,
                    right: rect.right,
                    bottom: rect.bottom - offsetY,
                });
            }
        }
    }
    return rects;
}

/**
 * While `enabled` (the bottom HUD is live because no Expand is open), the
 * `bottom` in px that lifts the bar at `ref` above the bottom HUD it would
 * cover; null otherwise, or when nothing is in the way. The HUD is measured
 * before paint and again only when a bottom region resizes or finishes an
 * entrance animation, or the window resizes. Nothing runs per frame.
 */
export function useBlockExpandBarLift(
    ref: RefObject<HTMLElement | null>,
    enabled: boolean,
) {
    const [bottom, setBottom] = useState<number | null>(null);

    useLayoutEffect(() => {
        const bar = ref.current;
        const root = bar?.parentElement;
        if (!enabled || !bar || !root) {
            setBottom(null);
            return;
        }

        const container =
            bar.offsetParent instanceof HTMLElement ? bar.offsetParent : root;
        let frame: number | null = null;
        const measure = () => {
            frame = null;
            const next = resolveBlockExpandBarBottom({
                bar: bar.getBoundingClientRect(),
                container: container.getBoundingClientRect(),
                obstacles: measureLiveBottomHud(root),
            });
            setBottom((current) => (current === next ? current : next));
        };
        const scheduleMeasure = () => {
            if (frame === null) {
                frame = window.requestAnimationFrame(measure);
            }
        };
        const scheduleMeasureForHudMotion = (event: Event) => {
            if (
                event.target instanceof Element &&
                event.target.closest(
                    blockExpandBarBottomHudSelectors.join(', '),
                )
            ) {
                scheduleMeasure();
            }
        };

        measure();
        const resizeObserver =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(scheduleMeasure);
        for (const selector of blockExpandBarBottomHudSelectors) {
            const region = root.querySelector(selector);
            if (region) {
                resizeObserver?.observe(region);
            }
        }
        window.addEventListener('resize', scheduleMeasure);
        root.addEventListener('animationend', scheduleMeasureForHudMotion);
        root.addEventListener('transitionend', scheduleMeasureForHudMotion);

        return () => {
            if (frame !== null) {
                window.cancelAnimationFrame(frame);
            }
            resizeObserver?.disconnect();
            window.removeEventListener('resize', scheduleMeasure);
            root.removeEventListener(
                'animationend',
                scheduleMeasureForHudMotion,
            );
            root.removeEventListener(
                'transitionend',
                scheduleMeasureForHudMotion,
            );
        };
    }, [enabled, ref]);

    return enabled ? bottom : null;
}

/** Room the corner knob keeps above the open Expand bar, in px. */
export const blockExpandHandleBarGap = 12;
/** Half the knob's 44 px hit area. */
export const blockExpandHandleRadius = 22;

/**
 * How many pixels the view has to slide up so the open Expand bar does not
 * cover the corner knob; null when it is clear already. A knob under the
 * bar, or below it, comes to rest `gap` above the bar's top edge. Null as
 * well when the canvas above the bar has no room for the knob (a short
 * landscape phone); the player pans there. Client coordinates.
 */
export function resolveExpandHandleClearance({
    bar,
    canvas,
    gap = blockExpandHandleBarGap,
    handle,
    radius = blockExpandHandleRadius,
}: {
    bar: BlockExpandBarRect;
    canvas: { left: number; top: number; width: number; height: number };
    handle: { x: number; y: number };
    gap?: number;
    radius?: number;
}): number | null {
    if (canvas.width <= 0 || canvas.height <= 0) {
        return null;
    }

    const overlapsHorizontally =
        handle.x + radius > bar.left - gap &&
        handle.x - radius < bar.right + gap;
    const clearY = bar.top - gap - radius;
    if (!overlapsHorizontally || handle.y <= clearY) {
        return null;
    }
    if (clearY - radius < canvas.top) {
        return null;
    }

    return handle.y - clearY;
}

/**
 * Reports the client rectangle of the bar at `ref` while `onChange` is set:
 * at mount, when the bar resizes or finishes its entrance, and when the
 * window resizes; null once it unmounts. Nothing runs per frame.
 */
export function useBlockExpandBarRectReport(
    ref: RefObject<HTMLElement | null>,
    onChange: ((rect: BlockExpandBarRect | null) => void) | null,
) {
    useLayoutEffect(() => {
        const bar = ref.current;
        if (!onChange || !bar) {
            return;
        }

        let frame: number | null = null;
        const measure = () => {
            frame = null;
            const rect = bar.getBoundingClientRect();
            onChange({
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
            });
        };
        const scheduleMeasure = () => {
            if (frame === null) {
                frame = window.requestAnimationFrame(measure);
            }
        };

        measure();
        const resizeObserver =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(scheduleMeasure);
        resizeObserver?.observe(bar);
        window.addEventListener('resize', scheduleMeasure);
        bar.addEventListener('animationend', scheduleMeasure);

        return () => {
            if (frame !== null) {
                window.cancelAnimationFrame(frame);
            }
            resizeObserver?.disconnect();
            window.removeEventListener('resize', scheduleMeasure);
            bar.removeEventListener('animationend', scheduleMeasure);
            onChange(null);
        };
    }, [onChange, ref]);
}
