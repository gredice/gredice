import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gameQualityProfiles } from '../../gameQuality';
import { createSkyObstacles, emptySkyObstacles } from '../skyLayout';
import { targetIslandColumns, targetIslandHull } from '../skyLayout.fixture';
import { resolveWeatherTierCaps } from '../weatherTierCaps';
import {
    bandCloudCapacity,
    bandCloudLobes,
    createBandCloudShapes,
    placeBandCloud,
    resolveBandCloudWant,
    resolveBandCover,
    resolveBandLimitAt,
    resolveCloudBandShape,
    resolveCloudHaze,
    resolveDeckAmount,
    stepBandCloudPresence,
} from './cloudBand';

const targetObstacles = createSkyObstacles(
    targetIslandHull,
    targetIslandColumns,
);

function bandShape(cover: number, widthPx = 1280, heightPx = 800) {
    return resolveCloudBandShape({
        cover,
        halfHeight: heightPx / 200,
        halfWidth: widthPx / 200,
        obstacles: targetObstacles,
        pixelsPerUnit: 100,
    });
}

describe('cloud band', () => {
    it('seeds varied cumulus, stratocumulus and fractus shapes', () => {
        const shapes = createBandCloudShapes(1);
        assert.equal(shapes.length, bandCloudCapacity);
        assert.deepEqual(
            new Set(shapes.map((shape) => shape.kind)),
            new Set(['cumulus', 'strato', 'fractus']),
        );
        for (const shape of shapes) {
            // GAME_ART: width 180 to 520 px, height 0.25 to 0.5 of it.
            assert.ok(shape.width >= 180 && shape.width <= 520);
            const aspect = shape.height / shape.width;
            assert.ok(aspect >= 0.25 && aspect <= 0.5, `${aspect}`);
            assert.ok(Math.abs(shape.opacity - 1) <= 0.1);
            assert.ok(Math.abs(shape.tone) <= 0.1);
            assert.ok(shape.speed >= 0.6 && shape.speed <= 1.4);
            assert.ok(shape.lobes.length <= bandCloudLobes);
            // The ragged base sits on the base line; the body is above it.
            assert.ok(shape.box[1] < 0 && shape.box[3] > 0);
        }
        // No two clouds alike.
        const widths = new Set(shapes.map((shape) => shape.width.toFixed(1)));
        assert.equal(widths.size, shapes.length);
        assert.deepEqual(createBandCloudShapes(1), shapes);
    });

    it('caps separate clouds at 10 / 7 / 4 per tier', () => {
        const tiers = ['high', 'medium', 'low'] as const;
        const caps = tiers.map(
            (tier) =>
                resolveWeatherTierCaps(gameQualityProfiles[tier]).bandClouds,
        );
        assert.deepEqual(caps, [10, 7, 4]);
        for (const [index, cap] of caps.entries()) {
            const tier = tiers[index];
            const shown = Array.from(
                { length: bandCloudCapacity },
                (_, index) =>
                    resolveBandCloudWant({
                        cap,
                        cover: 1,
                        index,
                        thunder: false,
                    }),
            ).filter((want) => want > 0).length;
            assert.equal(shown, cap, tier);
        }
    });

    it('adds clouds as cover grows: none under 0.05, one to three to 0.3', () => {
        const count = (cover: number) =>
            Array.from({ length: bandCloudCapacity }, (_, index) =>
                resolveBandCloudWant({
                    cap: 10,
                    cover,
                    index,
                    thunder: false,
                }),
            ).filter((want) => want > 0.5).length;
        assert.equal(count(0.04), 0);
        assert.ok(count(0.12) >= 1 && count(0.3) <= 3);
        assert.ok(count(0.5) > count(0.3));
        // Continuous: a joining cloud ramps in over 0.05 of cover.
        const half = resolveBandCloudWant({
            cap: 10,
            cover: 0.075,
            index: 0,
            thunder: false,
        });
        assert.ok(half > 0.3 && half < 0.7);
    });

    it('lays one continuous deck from cover 0.8 and lifts cover under thunder', () => {
        assert.equal(resolveDeckAmount(0.4), 0);
        assert.ok(resolveDeckAmount(0.8) > 0.8);
        assert.equal(resolveDeckAmount(0.9), 1);
        assert.equal(resolveBandCover(0.1, 1), 0.86);
        assert.equal(resolveBandCover(0.95, 1), 0.95);
        assert.equal(resolveBandCover(0.3, 0), 0.3);
    });

    it('takes the top 30% of the view, 35% under full cover', () => {
        const open = (cover: number) =>
            resolveCloudBandShape({
                cover,
                halfHeight: 4,
                halfWidth: 6.4,
                obstacles: emptySkyObstacles,
                pixelsPerUnit: 100,
            });
        assert.equal(open(0.4).maxLimitPx, 240);
        assert.equal(open(0.4).minLimitPx, 240);
        assert.ok(Math.abs(open(1).maxLimitPx - 280) < 1e-9);
        // Over the garden at most 10% of the view height, smoothed but
        // never past the raw limit.
        const garden = bandShape(1);
        garden.limitsPx.forEach((limit, column) => {
            const top = garden.gardenTopPx[column] ?? Infinity;
            assert.ok(limit <= Math.min(280, top + 80) + 1e-9);
        });
        assert.ok(resolveBandLimitAt(garden, 640) < 200);
    });

    it('adds a faint haze: none when clear, up to 14% under full cover', () => {
        assert.equal(resolveCloudHaze(0.02), 0);
        assert.ok(resolveCloudHaze(0.4) > 0.04 && resolveCloudHaze(0.4) < 0.07);
        assert.ok(Math.abs(resolveCloudHaze(0.9) - 0.14) < 1e-9);
    });

    it('fades in over 1.5 s (250 ms under reduced motion) with no overshoot', () => {
        const run = (reducedMotion: boolean, seconds: number) => {
            let presence = 0;
            let peak = 0;
            for (let t = 0; t < seconds; t += 1 / 60) {
                presence = stepBandCloudPresence(presence, 1, 1 / 60, {
                    frozen: false,
                    reducedMotion,
                });
                peak = Math.max(peak, presence);
            }
            return { presence, peak };
        };
        assert.ok(run(false, 0.75).presence < 0.55);
        assert.ok(run(false, 1.52).presence > 0.999);
        assert.equal(run(false, 3).peak, 1);
        assert.ok(run(true, 0.12).presence < 0.55);
        assert.ok(run(true, 0.27).presence > 0.999);
        assert.equal(
            stepBandCloudPresence(0, 1, 0, {
                frozen: true,
                reducedMotion: false,
            }),
            1,
        );
    });

    it('keeps every cloud inside the band and drifts it either way', () => {
        const shapes = createBandCloudShapes(1);
        for (const cover of [0.4, 0.92]) {
            const band = bandShape(cover);
            for (const shape of shapes) {
                for (const travelPx of [0, 119, -630]) {
                    const placed = placeBandCloud(shape, band, {
                        presence: 1,
                        reducedMotion: false,
                        travelPx,
                    });
                    assert.ok(placed);
                    const bottom = placed.base + shape.box[3] * placed.scale;
                    const limit = Math.max(
                        resolveBandLimitAt(
                            band,
                            placed.x + shape.box[0] * placed.scale,
                        ),
                        resolveBandLimitAt(band, placed.x),
                        resolveBandLimitAt(
                            band,
                            placed.x + shape.box[2] * placed.scale,
                        ),
                    );
                    // The shader fades whatever reaches past the limit.
                    assert.ok(
                        bottom <= limit + 0.25 * shape.height,
                        `${bottom} ${limit}`,
                    );
                    assert.ok(placed.base > 0);
                }
            }
        }
        const [first] = shapes;
        assert.ok(first);
        const band = bandShape(0.4);
        const at = (travelPx: number) =>
            placeBandCloud(first, band, {
                presence: 1,
                reducedMotion: false,
                travelPx,
            })?.x ?? Number.NaN;
        // It drifts the way the band travels, at its own share of the speed
        // (`resolveCloudDrift` signs the travel: left is negative).
        assert.ok(Math.abs(at(10) - at(0) - 10 * first.speed) < 1e-9);
        assert.ok(Math.abs(at(-10) - at(0) + 10 * first.speed) < 1e-9);
        assert.equal(
            placeBandCloud(first, band, {
                presence: 0,
                reducedMotion: false,
                travelPx: 0,
            }),
            null,
        );
    });
});
