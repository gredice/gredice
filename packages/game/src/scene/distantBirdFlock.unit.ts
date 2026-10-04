import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import {
    createDistantBirdFlockWindow,
    distantBirdFramingOpacity,
    resolveDistantBirdFlockBounds,
    resolveDistantBirdFlockCount,
    sampleDistantBirdFlockWindow,
    sampleDistantBirdPosition,
} from './distantBirdFlock';

test('seeded slots remain sparse, repeatable and separated, including elapsed jumps', () => {
    for (let slot = 0; slot < 100; slot++) {
        const window = createDistantBirdFlockWindow('23:2026-10-22', slot);
        assert.deepEqual(
            window,
            createDistantBirdFlockWindow('23:2026-10-22', slot),
        );
        assert.ok(
            window.start >= slot * 360 + 75 && window.start < slot * 360 + 155,
        );
        assert.ok(window.duration >= 24 && window.duration < 28);
        assert.ok(
            createDistantBirdFlockWindow('23:2026-10-22', slot + 1).start -
                window.start -
                window.duration >
                250,
        );
        assert.equal(
            sampleDistantBirdFlockWindow('23:2026-10-22', window.start).opacity,
            0,
        );
        assert.equal(
            sampleDistantBirdFlockWindow('23:2026-10-22', window.start).active,
            true,
        );
        assert.equal(
            sampleDistantBirdFlockWindow(
                '23:2026-10-22',
                window.start + window.duration,
            ).opacity,
            0,
        );
        assert.equal(
            sampleDistantBirdFlockWindow(
                '23:2026-10-22',
                window.start + window.duration / 2,
            ).opacity,
            1,
        );
    }
    assert.notDeepEqual(
        createDistantBirdFlockWindow('24:2026-10-22', 0),
        createDistantBirdFlockWindow('23:2026-10-22', 0),
    );
    assert.equal(sampleDistantBirdFlockWindow('a', 360_000).slot, 1_000);
    assert.equal(sampleDistantBirdFlockWindow('a', Number.NaN).active, false);
});

test('caps disable low/reduced-motion/harsh-weather and fail closed on invalid weather', () => {
    assert.equal(resolveDistantBirdFlockCount({ tier: 'high' }), 5);
    assert.equal(resolveDistantBirdFlockCount({ tier: 'medium' }), 3);
    for (const tier of ['low', 'auto-constrained'] as const)
        assert.equal(resolveDistantBirdFlockCount({ tier }), 0);
    for (const condition of [
        { enabled: false },
        { reducedMotion: true },
        { rain: 0.5 },
        { snow: 0.06 },
        { fog: 0.6 },
        { windSpeed: 12 },
        { rain: NaN },
    ]) {
        assert.equal(
            resolveDistantBirdFlockCount({ tier: 'high', ...condition }),
            0,
        );
    }
});

test('all bounded formation positions stay outside garden footprint and edges fade continuously', () => {
    const bounds = resolveDistantBirdFlockBounds([
        { position: new Vector3(-7, 0, -7), blocks: [] },
        { position: new Vector3(7, 0, 7), blocks: [] },
    ]);
    for (let tick = 0; tick <= 100; tick++) {
        const original = createDistantBirdFlockWindow('garden', 0);
        const window = sampleDistantBirdFlockWindow(
            'garden',
            original.start + (original.duration * tick) / 100,
        );
        for (let index = 0; index < 5; index++) {
            const position = sampleDistantBirdPosition(window, bounds, index);
            assert.ok(position.z > 13 && position.y > 5);
            assert.ok(Math.abs(position.x) < 39);
        }
    }
    assert.equal(distantBirdFramingOpacity(1, 0, 0), 0);
    assert.equal(distantBirdFramingOpacity(0.9, 0, 0).toFixed(2), '0.50');
    assert.equal(distantBirdFramingOpacity(0, 0, 1.1), 0);
});
