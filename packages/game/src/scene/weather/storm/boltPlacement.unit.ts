import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveBandLimitAt, resolveDeckFade } from '../sky/cloudBand';
import {
    createSkyObstacles,
    layoutSky,
    type SkyObstacles,
    type ViewPolygon,
} from '../skyLayout';
import { targetIslandColumns, targetIslandHull } from '../skyLayout.fixture';
import {
    createBoltGeometry,
    resolveBoltSilhouetteArea,
    resolveBoltSpan,
} from './boltGeometry';
import {
    boltTuckShare,
    pickBoltAnchor,
    resolveBoltPlacement,
} from './boltPlacement';

const geometry = createBoltGeometry();
const measure = {
    silhouetteArea: resolveBoltSilhouetteArea(geometry),
    span: resolveBoltSpan(geometry),
};

const island = createSkyObstacles(targetIslandHull, targetIslandColumns);

/** A farm that fills the view below `topV` (view units), edge to edge. */
function fillingGarden(halfWidth: number, halfHeight: number, topV: number) {
    const hull: ViewPolygon = [
        [-halfWidth - 1, -halfHeight - 1],
        [halfWidth + 1, -halfHeight - 1],
        [halfWidth + 1, topV],
        [-halfWidth - 1, topV],
    ];
    return createSkyObstacles(hull, []);
}

type Case = {
    name: string;
    widthPx: number;
    heightPx: number;
    pixelsPerUnit: number;
    obstacles: (halfWidth: number, halfHeight: number) => SkyObstacles;
};

const cases: Case[] = [
    {
        name: 'default island 1280×800',
        widthPx: 1280,
        heightPx: 800,
        pixelsPerUnit: 100,
        obstacles: () => island,
    },
    {
        name: 'default island at zoom 75',
        widthPx: 1280,
        heightPx: 800,
        pixelsPerUnit: 75,
        obstacles: () => island,
    },
    {
        name: 'default island at zoom 170',
        widthPx: 1280,
        heightPx: 800,
        pixelsPerUnit: 170,
        obstacles: () => island,
    },
    {
        name: 'phone 390×844',
        widthPx: 390,
        heightPx: 844,
        pixelsPerUnit: 100,
        obstacles: () => island,
    },
    {
        name: 'farm filling the view',
        widthPx: 1280,
        heightPx: 800,
        pixelsPerUnit: 100,
        obstacles: (halfWidth, halfHeight) =>
            fillingGarden(halfWidth, halfHeight, halfHeight - 1.2),
    },
    {
        name: 'farm on a phone',
        widthPx: 390,
        heightPx: 844,
        pixelsPerUnit: 100,
        obstacles: (halfWidth, halfHeight) =>
            fillingGarden(halfWidth, halfHeight, halfHeight - 2),
    },
];

function stormLayout({ heightPx, obstacles, pixelsPerUnit, widthPx }: Case) {
    const halfWidth = widthPx / 2 / pixelsPerUnit;
    const halfHeight = heightPx / 2 / pixelsPerUnit;
    return layoutSky({
        cloudy: 0.3,
        obstacles: obstacles(halfWidth, halfHeight),
        thunder: true,
        view: { halfHeight, halfWidth, pixelsPerUnit },
        windClass: 3,
    });
}

describe('bolt placement', () => {
    it('hangs every strike from the overcast deck, never from a free-sky cloud', () => {
        for (const view of cases) {
            const layout = stormLayout(view);
            for (const side of [0, 1] as const) {
                const anchor = pickBoltAnchor(layout.boltAnchors, side);
                assert.ok(anchor, `${view.name}: an anchor for side ${side}`);
                assert.equal(anchor.kind, 'band', view.name);
                assert.ok(anchor.kind === 'band' && anchor.deck, view.name);
                // The stretch of deck it hangs from exists.
                assert.ok(layout.band[anchor.band], view.name);
                assert.ok(layout.cloudBand.deck > 0.99, view.name);
            }
        }
    });

    it('tucks the bolt top into the deck body and glows at the root', () => {
        for (const view of cases) {
            const layout = stormLayout(view);
            const halfWidth = view.widthPx / 2 / view.pixelsPerUnit;
            const halfHeight = view.heightPx / 2 / view.pixelsPerUnit;
            for (const anchor of layout.boltAnchors) {
                assert.ok(anchor);
                const placement = resolveBoltPlacement({
                    anchor,
                    geometry: measure,
                    layout,
                    view,
                });
                assert.ok(placement, view.name);
                const toPx = (v: number) =>
                    (halfHeight - v) * view.pixelsPerUnit;
                const rootPx = toPx(placement.rootV);
                const topPx = toPx(placement.centreV) - placement.heightPx / 2;
                const tipPx = topPx + placement.heightPx;
                const limit = resolveBandLimitAt(
                    layout.cloudBand,
                    (placement.rootU + halfWidth) * view.pixelsPerUnit,
                );
                // The deck shader: a soft body down to E = L − F, ragged
                // hanging masses round E, nothing below the limit L.
                const fade = resolveDeckFade(limit);
                const bodyStart = limit - fade + 0.1 * fade;
                const label = `${view.name}, ${anchor.side}`;
                assert.ok(
                    Math.abs(
                        rootPx - topPx - boltTuckShare * placement.heightPx,
                    ) < 1e-6,
                    `${label}: the top ${boltTuckShare * 100}% sits above the root`,
                );
                assert.ok(
                    topPx <= bodyStart + 1e-6,
                    `${label}: top ${topPx.toFixed(1)} px reaches the deck body at ${bodyStart.toFixed(1)} px`,
                );
                assert.ok(
                    rootPx < limit - 8,
                    `${label}: root ${rootPx.toFixed(1)} px inside the deck's lip (limit ${limit.toFixed(1)} px)`,
                );
                assert.ok(
                    tipPx > limit,
                    `${label}: the bolt shows below the deck`,
                );
                // The glow sits on the root, like the target's.
                assert.equal(placement.glowU, placement.rootU);
                assert.equal(placement.glowV, placement.rootV);
                assert.ok(placement.glowRadiusPx > 10, label);
                assert.ok(placement.glowRadiusPx <= 64, label);
                assert.equal(placement.out, placement.rootU < 0 ? -1 : 1);
            }
        }
    });

    it('keeps the 150 px bolt in free sky on a desktop view and strikes on both sides', () => {
        const layout = stormLayout(cases[0] as Case);
        const [left, right] = layout.boltAnchors;
        assert.ok(left && right);
        const view = cases[0] as Case;
        const leftPlacement = resolveBoltPlacement({
            anchor: left,
            geometry: measure,
            layout,
            view,
        });
        const rightPlacement = resolveBoltPlacement({
            anchor: right,
            geometry: measure,
            layout,
            view,
        });
        assert.equal(leftPlacement?.heightPx, 150);
        assert.equal(rightPlacement?.heightPx, 150);
        // Strike 0 (side 0) lands on the left, strike 1 on the right.
        assert.ok(left.rootU < 0 && right.rootU > 0);
        assert.equal(leftPlacement?.out, -1);
        assert.equal(rightPlacement?.out, 1);
    });

    it('takes the other side when one side has no anchor', () => {
        const layout = stormLayout(cases[0] as Case);
        const [left] = layout.boltAnchors;
        assert.ok(left);
        assert.equal(pickBoltAnchor([left, null], 1), left);
        assert.equal(pickBoltAnchor([null, left], 0), left);
        assert.equal(pickBoltAnchor([null, null], 0), null);
    });
});
