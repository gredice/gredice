'use client';

import { type RefObject, useEffect } from 'react';
import { useGameState, useGameStateStore } from '../useGameState';
import type { HudObstacleRect } from './blockEditingState';

/** HUD regions the pop-up must not cover (`GameHud` data attributes). */
export const blockOptionsHudObstacleSelectors = [
    '[data-game-hud-top-left]',
    '[data-game-hud-top-right]',
    '[data-game-hud-bottom-right]',
    '[data-game-hud-bottom-controls]',
    '[data-game-hud-bottom-items]',
] as const;

const blockOptionsHudRegionSelector =
    blockOptionsHudObstacleSelectors.join(', ');

/** Smaller boxes (below 12 × 12 px of area) are not worth steering around. */
const minHudObstacleArea = 12 * 12;

function isMeasurableHudChild(element: Element, rect: DOMRect) {
    // Empty boxes, 1 px screen-reader-only text and tiny boxes (an empty
    // widget wrapper, a dot) are not obstacles.
    if (
        rect.width <= 1 ||
        rect.height <= 1 ||
        rect.width * rect.height < minHudObstacleArea
    ) {
        return false;
    }

    const style = getComputedStyle(element);
    return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity) > 0
    );
}

/**
 * Client rectangles of the visible children of each HUD region under
 * `root`. Children are measured rather than the regions themselves because
 * some regions span the whole width (the bottom item row) while their
 * content does not.
 */
export function measureBlockOptionsHudObstacles(
    root: ParentNode,
): HudObstacleRect[] {
    const rects: HudObstacleRect[] = [];
    for (const selector of blockOptionsHudObstacleSelectors) {
        const container = root.querySelector(selector);
        if (!container) {
            continue;
        }

        for (const child of container.children) {
            const rect = child.getBoundingClientRect();
            if (!isMeasurableHudChild(child, rect)) {
                continue;
            }

            rects.push({
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
            });
        }
    }

    return rects;
}

/**
 * Keeps `blockOptionsHudObstacles` up to date while the pop-up or Expand is
 * open, so the pop-up can be placed clear of the HUD. `rootRef` points at an
 * element whose parent holds this game's HUD. Measurement runs at most once
 * per frame, on resize of a HUD region, window resize or scroll, and when an
 * animation or transition inside a HUD region ends (the scene's speech and
 * notification bubbles share the container and are ignored); nothing runs
 * while editing is closed.
 */
export function useBlockOptionsHudObstacles(
    rootRef: RefObject<Element | null>,
) {
    const store = useGameStateStore();
    const active = useGameState(
        (state) =>
            state.blockEditing?.mode === 'menu' ||
            state.blockEditing?.mode === 'expand',
    );

    useEffect(() => {
        const root = rootRef.current?.parentElement;
        if (!active || !root) {
            return;
        }

        let frame: number | null = null;
        const measure = () => {
            frame = null;
            store
                .getState()
                .setBlockOptionsHudObstacles(
                    measureBlockOptionsHudObstacles(root),
                );
        };
        const scheduleMeasure = () => {
            if (frame === null) {
                frame = window.requestAnimationFrame(measure);
            }
        };
        const scheduleMeasureForHudMotion = (event: Event) => {
            if (
                event.target instanceof Element &&
                event.target.closest(blockOptionsHudRegionSelector)
            ) {
                scheduleMeasure();
            }
        };

        measure();
        const resizeObserver =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(scheduleMeasure);
        for (const selector of blockOptionsHudObstacleSelectors) {
            const container = root.querySelector(selector);
            if (container) {
                resizeObserver?.observe(container);
            }
        }
        window.addEventListener('resize', scheduleMeasure);
        window.addEventListener('scroll', scheduleMeasure, true);
        root.addEventListener('transitionend', scheduleMeasureForHudMotion);
        root.addEventListener('animationend', scheduleMeasureForHudMotion);

        return () => {
            if (frame !== null) {
                window.cancelAnimationFrame(frame);
            }
            resizeObserver?.disconnect();
            window.removeEventListener('resize', scheduleMeasure);
            window.removeEventListener('scroll', scheduleMeasure, true);
            root.removeEventListener(
                'transitionend',
                scheduleMeasureForHudMotion,
            );
            root.removeEventListener(
                'animationend',
                scheduleMeasureForHudMotion,
            );
            store.getState().setBlockOptionsHudObstacles([]);
        };
    }, [active, rootRef, store]);
}
