import type { HudObstacleRect } from './blockEditingState';

/** Which side of the block the pop-up sits on. */
export type BlockOptionsPopupSide = 'above' | 'below' | 'right' | 'left';

/** The block on screen, in canvas pixels. */
export type BlockOptionsPopupTarget = {
    /** Horizontal centre of the block. */
    x: number;
    /** The pop-up anchor above the block's top. */
    top: number;
    /** The bottom of the block. */
    bottom: number;
    /** Half the block's on-screen width. */
    halfWidth: number;
};

export type BlockOptionsPopupSize = {
    width: number;
    height: number;
};

export type BlockOptionsPopupPlacement = {
    /** Top-left corner of the pop-up in canvas pixels. */
    left: number;
    top: number;
    side: BlockOptionsPopupSide;
    /**
     * Where the tail meets the side that faces the block: from the pop-up's
     * left edge when it is above or below the block, from its top edge when
     * it is beside it.
     */
    tailOffset: number;
};

/** Distance the pop-up keeps from the canvas edges. */
export const blockOptionsPopupMargin = 8;
/** Distance between the pop-up and the block; the tail fills it. */
export const blockOptionsPopupGap = 12;
/** Extra room kept around HUD obstacles (their decorations can overhang). */
export const blockOptionsPopupObstaclePadding = 4;
/** The tail never comes closer to a corner than this. */
const tailInset = 16;

const sideOrder: readonly BlockOptionsPopupSide[] = [
    'above',
    'below',
    'right',
    'left',
];

type Rect = HudObstacleRect;

function clamp(value: number, min: number, max: number) {
    // A pop-up larger than the space keeps its start edge visible.
    return max < min ? min : Math.min(max, Math.max(min, value));
}

function intersectionArea(left: Rect, right: Rect) {
    const width =
        Math.min(left.right, right.right) - Math.max(left.left, right.left);
    const height =
        Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
    return width > 0 && height > 0 ? width * height : 0;
}

function rectArea(rect: Rect) {
    return (
        Math.max(0, rect.right - rect.left) *
        Math.max(0, rect.bottom - rect.top)
    );
}

/**
 * Converts HUD rectangles in client coordinates to canvas coordinates,
 * padded so the pop-up keeps a little room around them.
 */
export function toCanvasObstacleRects(
    rects: readonly HudObstacleRect[],
    canvas: { left: number; top: number },
    padding = blockOptionsPopupObstaclePadding,
): HudObstacleRect[] {
    return rects.map((rect) => ({
        left: rect.left - canvas.left - padding,
        top: rect.top - canvas.top - padding,
        right: rect.right - canvas.left + padding,
        bottom: rect.bottom - canvas.top + padding,
    }));
}

function candidateRect(
    side: BlockOptionsPopupSide,
    target: BlockOptionsPopupTarget,
    size: BlockOptionsPopupSize,
    viewport: BlockOptionsPopupSize,
    margin: number,
    gap: number,
): Rect {
    const middleY = (target.top + target.bottom) / 2;
    let left = target.x - size.width / 2;
    let top =
        side === 'below' ? target.bottom + gap : target.top - gap - size.height;
    if (side === 'right' || side === 'left') {
        left =
            side === 'right'
                ? target.x + target.halfWidth + gap
                : target.x - target.halfWidth - gap - size.width;
        top = middleY - size.height / 2;
    }

    // Slide along the side that faces the block, so the tail can still
    // point at it; moving away from the block is the next candidate's job.
    if (side === 'above' || side === 'below') {
        left = clamp(left, margin, viewport.width - margin - size.width);
    } else {
        top = clamp(top, margin, viewport.height - margin - size.height);
    }

    return {
        left,
        top,
        right: left + size.width,
        bottom: top + size.height,
    };
}

function tailOffsetFor(
    side: BlockOptionsPopupSide,
    rect: Rect,
    target: BlockOptionsPopupTarget,
) {
    if (side === 'above' || side === 'below') {
        const width = rect.right - rect.left;
        return clamp(target.x - rect.left, tailInset, width - tailInset);
    }

    const height = rect.bottom - rect.top;
    const middleY = (target.top + target.bottom) / 2;
    return clamp(middleY - rect.top, tailInset, height - tailInset);
}

/**
 * Places the options pop-up next to its block (spec §3.2). Tries above,
 * below, right and left of the block, in that order, and takes the first
 * place that stays inside the canvas (with `margin`) and covers no HUD
 * obstacle. When none does, it takes the place that covers the least
 * (outside area plus obstacle overlap) and clamps it into the canvas.
 * Everything is in canvas pixels.
 */
export function resolveBlockOptionsPopupPlacement({
    gap = blockOptionsPopupGap,
    margin = blockOptionsPopupMargin,
    obstacles,
    size,
    target,
    viewport,
}: {
    target: BlockOptionsPopupTarget;
    size: BlockOptionsPopupSize;
    viewport: BlockOptionsPopupSize;
    obstacles: readonly HudObstacleRect[];
    margin?: number;
    gap?: number;
}): BlockOptionsPopupPlacement {
    const inner: Rect = {
        left: margin,
        top: margin,
        right: viewport.width - margin,
        bottom: viewport.height - margin,
    };
    let best: { side: BlockOptionsPopupSide; rect: Rect; cost: number } | null =
        null;

    for (const side of sideOrder) {
        const rect = candidateRect(side, target, size, viewport, margin, gap);
        const outside = rectArea(rect) - intersectionArea(rect, inner);
        let overlap = 0;
        for (const obstacle of obstacles) {
            overlap += intersectionArea(rect, obstacle);
        }

        const cost = outside + overlap;
        if (cost <= 0) {
            return {
                left: rect.left,
                top: rect.top,
                side,
                tailOffset: tailOffsetFor(side, rect, target),
            };
        }
        if (!best || cost < best.cost) {
            best = { side, rect, cost };
        }
    }

    const side = best?.side ?? 'above';
    const rect =
        best?.rect ??
        candidateRect('above', target, size, viewport, margin, gap);
    const left = clamp(rect.left, margin, viewport.width - margin - size.width);
    const top = clamp(rect.top, margin, viewport.height - margin - size.height);
    const placed = {
        left,
        top,
        right: left + size.width,
        bottom: top + size.height,
    };

    return {
        left,
        top,
        side,
        tailOffset: tailOffsetFor(side, placed, target),
    };
}

/**
 * Where a bubble centred above a point (the carry hint) goes: its centre
 * slides so the bubble stays `margin` inside the canvas, and its tail moves
 * the other way, so it still points at the point (never closer than 16 px to
 * a corner). Before the bubble is measured (`width` 0) it is centred.
 */
export function resolveCenteredBubblePlacement({
    margin = blockOptionsPopupMargin,
    viewportWidth,
    width,
    x,
}: {
    /** The point's x in canvas pixels. */
    x: number;
    /** The bubble's width. */
    width: number;
    viewportWidth: number;
    margin?: number;
}) {
    if (!(width > 0) || !(viewportWidth > 0)) {
        return { center: x, tailShift: 0 };
    }

    const halfWidth = width / 2;
    const center = clamp(
        x,
        margin + halfWidth,
        viewportWidth - margin - halfWidth,
    );
    const tailReach = Math.max(0, halfWidth - tailInset);
    return {
        center,
        tailShift: clamp(x - center, -tailReach, tailReach),
    };
}
