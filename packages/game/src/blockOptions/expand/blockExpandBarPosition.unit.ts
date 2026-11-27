import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    blockExpandBarHudGap,
    blockExpandHandleBarGap,
    blockExpandHandleRadius,
    resolveBlockExpandBarBottom,
    resolveExpandHandleClearance,
} from './blockExpandBarPosition';

/** A 360 × 740 phone, measured on the real HUD (bar 20–340 wide). */
const container = { top: 0, bottom: 740 };
const bar = { left: 20, right: 340 };
const controls = [8, 48, 88, 128, 168].map((left) => ({
    left,
    top: 624,
    right: left + 40,
    bottom: 664,
}));
const items = [
    { left: 36, top: 672, right: 100, bottom: 736 },
    { left: 261, top: 672, right: 325, bottom: 736 },
];
const chat = { left: 312, top: 688, right: 352, bottom: 728 };

describe('resolveBlockExpandBarBottom', () => {
    it('lifts the bar above the controls row that sits above the items on phones', () => {
        assert.equal(
            resolveBlockExpandBarBottom({
                bar,
                container,
                obstacles: [...controls, ...items, chat],
            }),
            740 - 624 + blockExpandBarHudGap,
        );
    });

    it('clears only the items row when the controls sit beside the bar', () => {
        // 1280 × 800: the bar is centred, the controls are at the left.
        assert.equal(
            resolveBlockExpandBarBottom({
                bar: { left: 480, right: 800 },
                container: { top: 0, bottom: 800 },
                obstacles: [
                    { left: 8, top: 752, right: 48, bottom: 792 },
                    { left: 500, top: 724, right: 564, bottom: 796 },
                ],
            }),
            800 - 724 + blockExpandBarHudGap,
        );
    });

    it('ignores boxes beside the bar and boxes slid out of the container', () => {
        assert.equal(
            resolveBlockExpandBarBottom({
                bar,
                container,
                obstacles: [
                    // Touching the bar's edge is not an overlap.
                    { left: 340, top: 600, right: 380, bottom: 640 },
                    // The close-up view slides the rows below the screen.
                    { left: 40, top: 1364, right: 80, bottom: 1404 },
                ],
            }),
            null,
        );
        assert.equal(
            resolveBlockExpandBarBottom({ bar, container, obstacles: [] }),
            null,
        );
    });

    it('measures from the container, not the viewport', () => {
        assert.equal(
            resolveBlockExpandBarBottom({
                bar,
                container: { top: 100, bottom: 840 },
                obstacles: [{ left: 8, top: 724, right: 48, bottom: 764 }],
                gap: 4,
            }),
            120,
        );
    });
});

describe('resolveExpandHandleClearance', () => {
    // The open bar on a 360 × 740 phone: 20–340 wide, from y 462 to 660.
    const openBar = { left: 20, top: 462, right: 340, bottom: 660 };
    const canvas = { left: 0, top: 0, width: 360, height: 740 };
    const clearY =
        openBar.top - blockExpandHandleBarGap - blockExpandHandleRadius;

    it('moves a knob under the bar straight up above it', () => {
        // The integrator's phone case: the knob at (40, 580).
        const shift = resolveExpandHandleClearance({
            bar: openBar,
            canvas,
            handle: { x: 40, y: 580 },
        });
        assert.equal(shift, 580 - clearY);
    });

    it('also lifts a knob below the bar or at its top edge', () => {
        assert.notEqual(
            resolveExpandHandleClearance({
                bar: openBar,
                canvas,
                handle: { x: 180, y: 700 },
            }),
            null,
        );
        assert.notEqual(
            resolveExpandHandleClearance({
                bar: openBar,
                canvas,
                handle: { x: 180, y: clearY + 1 },
            }),
            null,
        );
    });

    it('leaves a knob that is clear of the bar', () => {
        assert.equal(
            resolveExpandHandleClearance({
                bar: openBar,
                canvas,
                handle: { x: 180, y: clearY },
            }),
            null,
        );
        // Beside a narrower bar on a wide screen.
        assert.equal(
            resolveExpandHandleClearance({
                bar: { left: 480, top: 520, right: 800, bottom: 720 },
                canvas: { left: 0, top: 0, width: 1280, height: 800 },
                handle: { x: 400, y: 640 },
            }),
            null,
        );
    });

    it('gives up when the canvas above the bar has no room for the knob', () => {
        assert.equal(
            resolveExpandHandleClearance({
                bar: { left: 20, top: 40, right: 340, bottom: 240 },
                canvas: { left: 0, top: 0, width: 360, height: 340 },
                handle: { x: 180, y: 200 },
            }),
            null,
        );
    });

    it('works in a canvas that does not start at the page corner', () => {
        const shift = resolveExpandHandleClearance({
            bar: { left: 120, top: 562, right: 440, bottom: 760 },
            canvas: { left: 100, top: 100, width: 360, height: 740 },
            handle: { x: 140, y: 680 },
        });
        assert.equal(
            shift,
            680 - (562 - blockExpandHandleBarGap - blockExpandHandleRadius),
        );
    });
});
