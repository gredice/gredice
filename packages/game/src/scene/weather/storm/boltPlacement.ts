import {
    type SkyBoltAnchor,
    type SkyLayout,
    skyLayoutRules,
} from '../skyLayout';
import { type BoltGeometryMeasure, resolveBoltSizing } from './boltFlash';

/**
 * Where a strike goes on screen (GAME_ART.md "Weather > Storm and
 * lightning"): the bolt hangs from the overcast deck's lower edge, at the
 * anchor `skyLayout` finds on the deck's lip (WP1's band always shows the
 * deck while it thunders). Its top 12% tucks up into the deck, which draws
 * over it, and the deck glows warm around the root, as in the target page
 * (`update()` in `docs/game-party-style/weather-scene.html`).
 *
 * View units: world units on the screen plane from the view centre, `u` to
 * the right and `v` up, as in `skyLayout.ts`.
 */

/** Share of the bolt's height tucked up into the deck above its root. */
export const boltTuckShare = 0.12;

export type BoltView = {
    widthPx: number;
    heightPx: number;
    pixelsPerUnit: number;
};

export type BoltPlacement = {
    /** The bolt's root on the deck's lip (view units). */
    rootU: number;
    rootV: number;
    /** The bolt's centre before it leans (view units). */
    centreU: number;
    centreV: number;
    /** Bolt height on screen, and in world units. */
    heightPx: number;
    heightWorld: number;
    /** The glow's centre: the root, on the deck's underside (view units). */
    glowU: number;
    glowV: number;
    glowRadiusPx: number;
    /** +1 leans out to the right, −1 to the left. */
    out: 1 | -1;
};

/**
 * The bolt and its glow for an anchor on the deck's lip. Pure, so a test can
 * check the tuck against the deck's shape.
 */
export function resolveBoltPlacement({
    anchor,
    geometry,
    layout,
    view,
}: {
    anchor: SkyBoltAnchor;
    geometry: BoltGeometryMeasure;
    layout: Pick<SkyLayout, 'band'>;
    view: BoltView;
}): BoltPlacement {
    const { pixelsPerUnit } = view;
    // The stretch of deck the bolt hangs from sets the glow's reach.
    const deckWidthPx =
        (layout.band[anchor.band]?.width ?? 0) * pixelsPerUnit ||
        skyLayoutRules.boltDeckWidthPx;
    // Pixel sizes that keep the strike inside the flash budget of the view.
    const sizing = resolveBoltSizing({
        anchorHeightPx: anchor.heightPx,
        cloudWidthPx: deckWidthPx,
        geometry,
        viewHeightPx: view.heightPx,
        viewWidthPx: view.widthPx,
    });
    const heightWorld = sizing.boltHeightPx / Math.max(1e-6, pixelsPerUnit);
    return {
        rootU: anchor.rootU,
        rootV: anchor.rootV,
        centreU: anchor.rootU,
        centreV: anchor.rootV - heightWorld * (0.5 - boltTuckShare),
        heightPx: sizing.boltHeightPx,
        heightWorld,
        glowU: anchor.rootU,
        glowV: anchor.rootV,
        glowRadiusPx: sizing.glowRadiusPx,
        out: anchor.out,
    };
}

/**
 * The anchor for a strike on `side`: its own side's, else the other one
 * (the deck has free sky below it on one side only).
 */
export function pickBoltAnchor(
    anchors: readonly [SkyBoltAnchor | null, SkyBoltAnchor | null],
    side: 0 | 1,
) {
    return anchors[side] ?? anchors[side === 0 ? 1 : 0];
}
