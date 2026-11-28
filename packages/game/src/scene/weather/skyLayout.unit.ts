import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveBandLimitAt, resolveDeckLip } from './sky/cloudBand';
import {
    convexHull,
    createSkyObstacles,
    emptySkyObstacles,
    layoutSky,
    rectHitsPolygon,
    resolveSkyCloudUnitHalf,
    type SkyLayoutInput,
    type ViewBasis,
    viewToWorld,
    worldToView,
} from './skyLayout';
import { targetIslandColumns, targetIslandHull } from './skyLayout.fixture';

const sqrt2 = Math.SQRT2;
const sqrt3 = Math.sqrt(3);
const sqrt6 = Math.sqrt(6);

/** The target page's (and the game's) default isometric camera. */
const isoBasis: ViewBasis = {
    right: { x: -1 / sqrt2, y: 0, z: 1 / sqrt2 },
    up: { x: 1 / sqrt6, y: 2 / sqrt6, z: 1 / sqrt6 },
    forward: { x: 1 / sqrt3, y: -1 / sqrt3, z: 1 / sqrt3 },
    origin: { x: 0, y: 0.42, z: 0 },
};

const targetObstacles = createSkyObstacles(
    targetIslandHull,
    targetIslandColumns,
);
const cloudUnitHalf = resolveSkyCloudUnitHalf(isoBasis);

function layout(
    widthPx: number,
    heightPx: number,
    weather: Pick<SkyLayoutInput, 'cloudy' | 'thunder' | 'windClass'>,
) {
    return layoutSky({
        obstacles: targetObstacles,
        view: {
            halfHeight: heightPx / 2 / 100,
            halfWidth: widthPx / 2 / 100,
            pixelsPerUnit: 100,
        },
        ...weather,
    });
}

function overlapsGarden(rect: readonly [number, number, number, number]) {
    return (
        rectHitsPolygon(rect, targetIslandHull) ||
        targetIslandColumns.some((column) => rectHitsPolygon(rect, column))
    );
}

describe('sky layout', () => {
    it('sizes a facing cloud from its box and the camera elevation', () => {
        const [first] = cloudUnitHalf;
        assert.ok(first);
        assert.equal(first[0], 0.5);
        // 0.197 × cos(35.26°) + 0.217 × sin(35.26°)
        assert.ok(Math.abs(first[1] - 0.286) < 0.001, `hv ${first[1]}`);
    });

    it('maps view spots to world altitudes and back', () => {
        const world = viewToWorld(isoBasis, 1.5, -2, 4.4, {
            x: 0,
            y: 0,
            z: 0,
        });
        assert.ok(Math.abs(world.y - 4.4) < 1e-9);
        const [u, v] = worldToView(isoBasis, world);
        assert.ok(Math.abs(u - 1.5) < 1e-9 && Math.abs(v + 2) < 1e-9);
    });

    it('puts no cloud in free sky: the band takes the top 30%, 35% under full cover', () => {
        const partly = layout(1280, 800, {
            cloudy: 0.4,
            thunder: false,
            windClass: 1,
        });
        assert.equal(partly.band.length, 0);
        assert.equal(Math.round(partly.cloudBand.sharePx), 240);
        assert.equal(Math.round(partly.cloudBand.maxLimitPx), 240);
        assert.equal(partly.cloudBand.deck, 0);
        const overcast = layout(1280, 800, {
            cloudy: 0.92,
            thunder: false,
            windClass: 1.2,
        });
        assert.equal(Math.round(overcast.cloudBand.sharePx), 280);
        assert.equal(overcast.cloudBand.deck, 1);
        // The band is reserved, so swooshes and sky mist rolls stay below.
        assert.deepEqual(
            overcast.placed.map((rect) => Math.round(rect[1] * 100) / 100),
            [1.2],
        );
    });

    it('hangs the band at most 10% of the view height over the garden', () => {
        for (const [width, height] of [
            [1280, 800],
            [390, 844],
            [960, 540],
        ] as const) {
            for (const cloudy of [0.05, 0.4, 0.65, 0.92, 1]) {
                const result = layout(width, height, {
                    cloudy,
                    thunder: cloudy === 1,
                    windClass: 2,
                });
                const band = result.cloudBand;
                assert.ok(band.overGardenPx <= 0.1 * height + 1e-6);
                band.limitsPx.forEach((limit, column) => {
                    assert.ok(limit <= band.sharePx + 1e-6);
                    const top = band.gardenTopPx[column] ?? Infinity;
                    assert.ok(
                        limit <= top + 0.1 * height + 1e-6,
                        `column ${column} at ${width}×${height}`,
                    );
                });
            }
        }
        // Over the tree on the default island the band stops 10% below it.
        const partly = layout(1280, 800, {
            cloudy: 0.4,
            thunder: false,
            windClass: 1,
        });
        assert.ok(Math.abs(partly.cloudBand.minLimitPx - (65 + 80)) < 1);
        assert.ok(Math.abs(partly.cloudBand.overGardenPx - 80) < 1e-6);
    });

    it('shows nothing under 0.05 and reserves no band', () => {
        const clear = layout(1280, 800, {
            cloudy: 0.04,
            thunder: false,
            windClass: 0,
        });
        assert.deepEqual(clear.placed, []);
        assert.deepEqual(clear.boltAnchors, [null, null]);
    });

    it('hangs a 150 px storm bolt from the deck lip in free sky on a desktop view', () => {
        const result = layout(1280, 800, {
            cloudy: 1,
            thunder: true,
            windClass: 3,
        });
        const [left, right] = result.boltAnchors;
        for (const anchor of [left, right]) {
            assert.ok(anchor?.kind === 'band');
            assert.equal(anchor.deck, true);
            assert.equal(anchor.heightPx, 150);
            assert.equal(anchor.overGarden, false);
            const height = anchor.heightPx / 100;
            assert.equal(
                overlapsGarden([
                    anchor.rootU - 0.32 * height,
                    anchor.rootV - height,
                    anchor.rootU + 0.32 * height,
                    anchor.rootV,
                ]),
                false,
                'the bolt never touches the garden',
            );
            // Its root sits on the deck's lip, inside the band.
            const limitPx = resolveBandLimitAt(
                result.cloudBand,
                (anchor.rootU + 6.4) * 100,
            );
            const lipPx = resolveDeckLip(limitPx);
            assert.ok(Math.abs((4 - anchor.rootV) * 100 - lipPx) < 1e-6);
            assert.ok(lipPx < limitPx);
            // The stretch of deck it hangs from carries the glow.
            const host = result.band[anchor.band];
            assert.ok(host && Math.abs(host.u - anchor.rootU) < 1e-9);
        }
        // Strikes alternate sides.
        assert.ok(left && right && left.rootU < 0 && right.rootU > 0);
    });

    it('lifts cover to the deck while it thunders, even under little cloud', () => {
        const result = layout(1280, 800, {
            cloudy: 0.1,
            thunder: true,
            windClass: 3,
        });
        assert.equal(result.cover, 0.86);
        assert.equal(result.cloudBand.deck, 1);
        assert.equal(result.boltAnchors[0]?.kind, 'band');
    });

    it('falls back to a 96 px bolt on a phone where no free sky is left', () => {
        const storm = layout(390, 844, {
            cloudy: 1,
            thunder: true,
            windClass: 3,
        });
        const [left, right] = storm.boltAnchors;
        assert.ok(left?.kind === 'band' && right?.kind === 'band');
        assert.equal(left.heightPx, 96);
        assert.ok(left.rootU < 0 && right.rootU > 0);
        // Still hangs from the band, never from below it.
        const limitPx = resolveBandLimitAt(
            storm.cloudBand,
            (left.rootU + 1.95) * 100,
        );
        assert.ok((4.22 - left.rootV) * 100 < limitPx);
    });

    it('keeps the over-garden bolt in the band strip and off standing objects', () => {
        const view = { halfHeight: 4, halfWidth: 6.4, pixelsPerUnit: 100 };
        const storm = (hullTop: number, columns: [number, number][][]) =>
            layoutSky({
                cloudy: 1,
                obstacles: createSkyObstacles(
                    [
                        [-7, -5],
                        [7, -5],
                        [7, hullTop],
                        [-7, hullTop],
                    ],
                    columns,
                ),
                thunder: true,
                view,
                windClass: 2,
            });
        // The garden fills the view up to 250 px from the top: no free sky,
        // but a short bolt dips into the band's strip over bare terrain.
        const open = storm(1.5, []);
        for (const anchor of open.boltAnchors) {
            assert.ok(anchor?.bolt && anchor.overGarden);
            assert.equal(anchor.heightPx, 96);
            const tipPx = (4 - (anchor.rootV - 0.96)) * 100;
            assert.ok(tipPx <= 250 + 80 + 1e-6, `${tipPx}`);
        }
        assert.equal(open.boltRects.length, 2);
        // A barn row along the far edge: no bolt fits, the deck only glows.
        const barns = storm(1.5, [
            [
                [-7, -1],
                [7, -1],
                [7, 1.6],
                [-7, 1.6],
            ],
        ]);
        for (const anchor of barns.boltAnchors) {
            assert.ok(anchor && anchor.bolt === false);
        }
        assert.deepEqual(barns.boltRects, []);
        // A farm reaching the top edge: nothing fits either.
        const farm = storm(3.9, []);
        assert.ok(farm.boltAnchors.every((anchor) => anchor?.bolt === false));
    });

    it('reserves the bolts so later sky props keep clear of them', () => {
        const result = layout(1280, 800, {
            cloudy: 1,
            thunder: true,
            windClass: 3,
        });
        assert.equal(result.boltRects.length, 2);
        for (const rect of result.boltRects) {
            assert.ok(result.placed.includes(rect));
        }
    });

    it('lays out quickly on an open view and keeps the band edge to edge', () => {
        const open = layoutSky({
            cloudy: 1,
            obstacles: emptySkyObstacles,
            thunder: false,
            view: { halfHeight: 4, halfWidth: 12, pixelsPerUnit: 100 },
            windClass: 0,
        });
        assert.equal(open.cloudBand.overGardenPx, 0);
        assert.equal(
            Math.round(open.cloudBand.minLimitPx),
            Math.round(open.cloudBand.maxLimitPx),
        );
        assert.equal(open.placed[0]?.[0], -24);
        assert.equal(open.placed[0]?.[2], 24);
    });

    it('builds convex hulls like the target', () => {
        const hull = convexHull([
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0.5, 0.5],
        ]);
        assert.deepEqual(hull, [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ]);
    });
});
