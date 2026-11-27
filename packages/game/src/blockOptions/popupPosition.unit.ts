import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { HudObstacleRect } from './blockEditingState';
import {
    type BlockOptionsPopupPlacement,
    type BlockOptionsPopupSize,
    type BlockOptionsPopupTarget,
    blockOptionsPopupGap,
    blockOptionsPopupMargin,
    resolveBlockOptionsPopupPlacement,
    resolveCenteredBubblePlacement,
    toCanvasObstacleRects,
} from './popupPosition';

const viewport: BlockOptionsPopupSize = { width: 960, height: 640 };
const size: BlockOptionsPopupSize = { width: 280, height: 84 };

function target(
    x: number,
    top: number,
    bottom = top + 60,
    halfWidth = 30,
): BlockOptionsPopupTarget {
    return { x, top, bottom, halfWidth };
}

function placementRect(placement: BlockOptionsPopupPlacement) {
    return {
        left: placement.left,
        top: placement.top,
        right: placement.left + size.width,
        bottom: placement.top + size.height,
    };
}

function intersects(left: HudObstacleRect, right: HudObstacleRect) {
    return (
        Math.min(left.right, right.right) > Math.max(left.left, right.left) &&
        Math.min(left.bottom, right.bottom) > Math.max(left.top, right.top)
    );
}

function assertInside(placement: BlockOptionsPopupPlacement) {
    const rect = placementRect(placement);
    assert.ok(rect.left >= blockOptionsPopupMargin, `left ${rect.left}`);
    assert.ok(rect.top >= blockOptionsPopupMargin, `top ${rect.top}`);
    assert.ok(
        rect.right <= viewport.width - blockOptionsPopupMargin,
        `right ${rect.right}`,
    );
    assert.ok(
        rect.bottom <= viewport.height - blockOptionsPopupMargin,
        `bottom ${rect.bottom}`,
    );
}

describe('resolveBlockOptionsPopupPlacement', () => {
    it('centres the pop-up above the block with the gap for the tail', () => {
        const placement = resolveBlockOptionsPopupPlacement({
            target: target(480, 300),
            size,
            viewport,
            obstacles: [],
        });

        assert.deepEqual(placement, {
            left: 480 - size.width / 2,
            top: 300 - blockOptionsPopupGap - size.height,
            side: 'above',
            tailOffset: size.width / 2,
        });
    });

    it('slides along the top edge near the left and right canvas edges and keeps the tail on the block', () => {
        const left = resolveBlockOptionsPopupPlacement({
            target: target(40, 300),
            size,
            viewport,
            obstacles: [],
        });
        assert.equal(left.side, 'above');
        assert.equal(left.left, blockOptionsPopupMargin);
        assert.equal(left.tailOffset, 40 - blockOptionsPopupMargin);
        assertInside(left);

        const right = resolveBlockOptionsPopupPlacement({
            target: target(955, 300),
            size,
            viewport,
            obstacles: [],
        });
        assert.equal(right.side, 'above');
        assert.equal(
            right.left,
            viewport.width - blockOptionsPopupMargin - size.width,
        );
        // The tail stops short of the rounded corner.
        assert.equal(right.tailOffset, size.width - 16);
        assertInside(right);
    });

    it('goes below the block when there is no room above it', () => {
        const placement = resolveBlockOptionsPopupPlacement({
            target: target(480, 40, 100),
            size,
            viewport,
            obstacles: [],
        });

        assert.equal(placement.side, 'below');
        assert.equal(placement.top, 100 + blockOptionsPopupGap);
        assertInside(placement);
    });

    it('flips below a top-left HUD obstacle', () => {
        const obstacle = { left: 8, top: 8, right: 220, bottom: 120 };
        const placement = resolveBlockOptionsPopupPlacement({
            target: target(160, 180, 240),
            size,
            viewport,
            obstacles: [obstacle],
        });

        assert.equal(placement.side, 'below');
        assert.equal(intersects(placementRect(placement), obstacle), false);
        assertInside(placement);
    });

    it('moves sideways away from a bottom-right obstacle when above and below are taken', () => {
        const obstacles = [
            // The top HUD row and the bottom item row.
            { left: 0, top: 0, right: 960, bottom: 200 },
            { left: 0, top: 380, right: 960, bottom: 640 },
            // A bottom-right chat button that reaches up the right side.
            { left: 860, top: 150, right: 960, bottom: 420 },
        ];
        const placement = resolveBlockOptionsPopupPlacement({
            target: target(700, 250, 320),
            size,
            viewport,
            obstacles,
        });

        assert.equal(placement.side, 'left');
        assert.ok(placement.left + size.width <= 700 - 30);
        for (const obstacle of obstacles) {
            assert.equal(intersects(placementRect(placement), obstacle), false);
        }
        // The tail meets the block's middle.
        assert.equal(placement.top + placement.tailOffset, (250 + 320) / 2);
    });

    it('takes the place with the least overlap and clamps it when every side is covered', () => {
        // Above and below are covered entirely. Both sides graze the top
        // and bottom rows by 2 px; the right side also touches a button.
        const obstacles = [
            { left: 0, top: 0, right: 960, bottom: 250 },
            { left: 0, top: 330, right: 960, bottom: 640 },
            { left: 820, top: 250, right: 960, bottom: 330 },
        ];
        const placement = resolveBlockOptionsPopupPlacement({
            target: target(500, 260, 320, 30),
            size,
            viewport,
            obstacles,
        });

        assert.equal(placement.side, 'left');
        assert.equal(placement.left, 500 - 30 - blockOptionsPopupGap - 280);
        assertInside(placement);
    });

    it('keeps the start edge visible when the pop-up is larger than the canvas', () => {
        const placement = resolveBlockOptionsPopupPlacement({
            target: target(100, 100),
            size: { width: 400, height: 900 },
            viewport: { width: 360, height: 740 },
            obstacles: [],
        });

        assert.equal(placement.left, blockOptionsPopupMargin);
        assert.equal(placement.top, blockOptionsPopupMargin);
    });

    it('fits a phone-width canvas', () => {
        const phone = { width: 360, height: 740 };
        const placement = resolveBlockOptionsPopupPlacement({
            target: target(330, 400),
            size,
            viewport: phone,
            obstacles: [],
        });

        assert.equal(placement.side, 'above');
        assert.ok(placement.left >= blockOptionsPopupMargin);
        assert.ok(
            placement.left + size.width <=
                phone.width - blockOptionsPopupMargin,
        );
    });
});

describe('toCanvasObstacleRects', () => {
    it('moves client rectangles into canvas coordinates with padding', () => {
        assert.deepEqual(
            toCanvasObstacleRects(
                [{ left: 110, top: 60, right: 210, bottom: 100 }],
                { left: 100, top: 50 },
                4,
            ),
            [{ left: 6, top: 6, right: 114, bottom: 54 }],
        );
    });
});

describe('resolveCenteredBubblePlacement', () => {
    it('keeps a bubble over a point in the middle centred', () => {
        assert.deepEqual(
            resolveCenteredBubblePlacement({
                x: 180,
                width: 200,
                viewportWidth: 360,
            }),
            { center: 180, tailShift: 0 },
        );
    });

    it('slides a bubble near the right edge inside and moves its tail back', () => {
        // The phone carry hint over a block at x 330.
        const placement = resolveCenteredBubblePlacement({
            x: 330,
            width: 240,
            viewportWidth: 360,
        });
        assert.equal(placement.center, 360 - blockOptionsPopupMargin - 120);
        assert.equal(placement.tailShift, 330 - placement.center);
        assert.equal(placement.center + 120, 360 - blockOptionsPopupMargin);
    });

    it('slides a bubble near the left edge and keeps the tail off the corner', () => {
        const placement = resolveCenteredBubblePlacement({
            x: 2,
            width: 200,
            viewportWidth: 360,
        });
        assert.equal(placement.center, blockOptionsPopupMargin + 100);
        // The tail stops 16 px from the bubble's left corner.
        assert.equal(placement.tailShift, -(100 - 16));
    });

    it('centres an unmeasured bubble', () => {
        assert.deepEqual(
            resolveCenteredBubblePlacement({
                x: 350,
                width: 0,
                viewportWidth: 360,
            }),
            { center: 350, tailShift: 0 },
        );
    });

    it('keeps the left edge visible when the bubble is wider than the canvas', () => {
        const placement = resolveCenteredBubblePlacement({
            x: 100,
            width: 400,
            viewportWidth: 360,
        });
        assert.equal(placement.center - 200, blockOptionsPopupMargin);
    });
});
