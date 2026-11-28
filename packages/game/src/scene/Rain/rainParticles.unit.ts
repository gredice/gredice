import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveRainDropCount,
    resolveWeatherTierCaps,
} from '../weather/weatherTierCaps';
import {
    advanceRainMotionOffset,
    limitRainSplashCount,
    rainAvatarField,
    rainDropLook,
    rainMotionWrap,
    rainSplashLook,
    resolveRainDropFallSpeed,
    resolveRainDropMotion,
    resolveRainDropOpacity,
    resolveRainDropSizePx,
    resolveRainField,
    resolveRainHeaviness,
    resolveRainSplashCount,
    resolveRainSplashOpacity,
} from './rainParticles';

const close = (actual: number, expected: number, epsilon = 1e-9) =>
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `${actual} is not ${expected}`,
    );

function caps(tier: 'low' | 'medium' | 'high') {
    const multiplier = { low: 0.35, medium: 0.7, high: 1 }[tier];
    return resolveWeatherTierCaps({
        rainParticleMultiplier: multiplier,
        shadows: tier !== 'low',
        snowParticleMultiplier: multiplier,
        tier,
    });
}

test('party drops: 840 / 588 / 294 in heavy rain on a 1280 x 800 view, continuous', () => {
    assert.equal(resolveRainDropCount(caps('high'), 1, 1), 840);
    assert.equal(resolveRainDropCount(caps('medium'), 1, 1), 588);
    assert.equal(resolveRainDropCount(caps('low'), 1, 1), 294);
    // Rain (0.6) shows about 430 on high; no steps between amounts.
    close(
        resolveRainDropCount(caps('high'), 0.6, 1),
        Math.round(840 * 0.6 ** 1.3),
    );
    let previous = 0;
    for (let rainy = 0.04; rainy <= 1; rainy += 0.01) {
        const count = resolveRainDropCount(caps('high'), rainy, 1);
        assert.ok(count >= previous && count - previous <= 15, `${rainy}`);
        previous = count;
    }
    // The count follows the screen's pixel area, up to the capacity.
    assert.equal(resolveRainDropCount(caps('high'), 1, 1.5), 1260);
    assert.equal(resolveRainDropCount(caps('high'), 1, 4), 1400);
    assert.equal(resolveRainDropCount(caps('high'), 0.03, 1), 0);
});

test('party drops: the field covers the view and scales with it', () => {
    const field = resolveRainField(6.4, 4);
    assert.equal(field.scale, 1);
    assert.equal(field.width, 12.8 + 1.5);
    assert.equal(field.height, 10);
    assert.equal(field.depth, 10);
    assert.equal(resolveRainField(2, 1).scale, 0.35);
    assert.equal(resolveRainField(40, 20).scale, 2.4);
});

test('party drops: 7.5 to 9 units per second, 1.4 under reduced motion', () => {
    assert.equal(resolveRainDropFallSpeed(0.5, false), 7.5);
    assert.equal(resolveRainDropFallSpeed(0.6, false), 7.5);
    assert.equal(resolveRainDropFallSpeed(0.8, false), 9);
    assert.equal(resolveRainDropFallSpeed(1, false), 9);
    assert.equal(resolveRainDropFallSpeed(1, true), 1.4);
});

test('party drops: heavy rain is rain at 0.8 or more', () => {
    assert.equal(resolveRainHeaviness(0.6), 0);
    close(resolveRainHeaviness(0.7), 0.5);
    assert.equal(resolveRainHeaviness(0.8), 1);
    assert.equal(resolveRainHeaviness(1), 1);
});

test('party drops: a slim streak 2.5 to 3 px wide, 14 px long in rain and 18 in heavy rain', () => {
    assert.deepEqual(resolveRainDropSizePx(0.5), {
        quadWidthPx: 5,
        coreWidthPx: 2.5,
        lengthPx: 14,
    });
    assert.deepEqual(resolveRainDropSizePx(1), {
        quadWidthPx: 5,
        coreWidthPx: 3,
        lengthPx: 18,
    });
    // The quad is wider than the streak, so its edges stay smooth.
    assert.ok(rainDropLook.quadWidthPx >= rainDropLook.coreWidthPx + 2);
    // Each drop draws at 0.55 to 0.75 opacity, so the garden shows through.
    assert.equal(rainDropLook.minOpacity, 0.55);
    assert.equal(rainDropLook.maxOpacity, 0.75);
    assert.equal(resolveRainDropOpacity(1), 1);
    assert.equal(resolveRainDropOpacity(0.03), 0);
    assert.ok(
        resolveRainDropOpacity(0.1) > 0 && resolveRainDropOpacity(0.1) < 1,
    );
    // Drops never sit above the cloud base: no drops above 2.7, fading from 1.9.
    assert.equal(rainDropLook.cloudBaseHeight, 2.7);
    assert.equal(rainDropLook.cloudFadeHeight, 1.9);
});

/** On-screen fall speed in CSS pixels per second for a view. */
function fallPxPerSecond(view: {
    halfHeight: number;
    halfWidth: number;
    pixelsPerUnit: number;
}) {
    const motion = resolveRainDropMotion({
        fallSpeed: 7.5,
        slant: 1.2,
        ...view,
    });
    const field = resolveRainField(view.halfWidth, view.halfHeight);
    return motion.fallVelocity * field.height * view.pixelsPerUnit;
}

test('party drops: rain falls at 750 px/s at any zoom and on any screen', () => {
    const views = [
        // 1280 x 800 at zoom 100, 75 and 170.
        { widthPx: 1280, heightPx: 800, pixelsPerUnit: 100 },
        { widthPx: 1280, heightPx: 800, pixelsPerUnit: 75 },
        { widthPx: 1280, heightPx: 800, pixelsPerUnit: 170 },
        // A phone and a tall desktop window.
        { widthPx: 390, heightPx: 844, pixelsPerUnit: 100 },
        { widthPx: 1600, heightPx: 1300, pixelsPerUnit: 100 },
    ];
    for (const { widthPx, heightPx, pixelsPerUnit } of views) {
        const view = {
            halfHeight: heightPx / 2 / pixelsPerUnit,
            halfWidth: widthPx / 2 / pixelsPerUnit,
            pixelsPerUnit,
        };
        close(fallPxPerSecond(view), 750, 1e-6);
    }
    const reference = resolveRainDropMotion({
        fallSpeed: 7.5,
        halfHeight: 4,
        halfWidth: 6.4,
        pixelsPerUnit: 100,
        slant: 1.2,
    });
    assert.equal(reference.fallVelocity, 0.75);
    close(reference.windVelocity, 1.2 / 14.3);
    // Zooming in keeps the field heights per second (the field shrinks with
    // the units per pixel), so a zoom never changes the normalised speed.
    const near = resolveRainDropMotion({
        fallSpeed: 7.5,
        halfHeight: 2,
        halfWidth: 3.2,
        pixelsPerUnit: 200,
        slant: 1.2,
    });
    close(near.fallVelocity, reference.fallVelocity);
});

test('party drops: the avatar views fill a box in front of the camera at 7.5 units per second', () => {
    // From just under the ground to the cloud base (2.7), so no drop is
    // spent above the clouds or under the ground.
    close(rainAvatarField.lift - rainAvatarField.height / 2, -0.3);
    close(
        rainAvatarField.lift + rainAvatarField.height / 2,
        rainDropLook.cloudBaseHeight,
    );
    const motion = resolveRainDropMotion({
        avatar: true,
        fallSpeed: 7.5,
        halfHeight: 4,
        halfWidth: 7,
        pixelsPerUnit: 37,
        slant: 1.2,
    });
    // Field heights per second × field height: world units per second, with
    // no zoom scale in a perspective view.
    close(motion.fallVelocity * rainAvatarField.height, 7.5);
    close(motion.windVelocity * rainAvatarField.width, 1.2);
});

test('party drops: motion offsets rebase without a jump and wrap exactly', () => {
    // A speed change keeps the offset the old speed reached.
    assert.equal(
        advanceRainMotionOffset(0.25, 0.75, 2, rainMotionWrap.fall),
        1.75,
    );
    assert.equal(advanceRainMotionOffset(19.5, 1, 1, rainMotionWrap.fall), 0.5);
    assert.equal(advanceRainMotionOffset(0.5, -1, 1, rainMotionWrap.wind), 0.5);
    close(advanceRainMotionOffset(0.2, 1, -5, rainMotionWrap.wind), 0.2);
    // 20 fall lengths are whole wraps for every speed step (0.85 to 1.15).
    for (let step = 0; step < 7; step += 1) {
        const speed = 0.85 + 0.05 * step;
        close((rainMotionWrap.fall * speed) % 1, 0, 1e-9);
    }
});

test('splash rings: small and short, radius 0.12 for 0.45 s', () => {
    assert.equal(rainSplashLook.radius, 0.12);
    assert.equal(rainSplashLook.lifeSeconds, 0.45);
});

test('splash rings: 29 / 14 / 0 in heavy rain, none under reduced motion', () => {
    assert.equal(
        resolveRainSplashCount(caps('high').splashRings, 1, false),
        29,
    );
    assert.equal(
        resolveRainSplashCount(caps('medium').splashRings, 1, false),
        14,
    );
    assert.equal(resolveRainSplashCount(caps('low').splashRings, 1, false), 0);
    assert.equal(resolveRainSplashCount(29, 1, true), 0);
    assert.equal(resolveRainSplashCount(29, 0.04, false), 0);
    assert.equal(
        resolveRainSplashCount(29, 0.6, false),
        Math.round(29 * 0.6 ** 1.2),
    );
    assert.equal(resolveRainSplashOpacity(0.05), 0);
    assert.equal(resolveRainSplashOpacity(0.3), 1);
    // A small garden gets the target's ring density, not all 29.
    assert.equal(limitRainSplashCount(29, 10), 20);
    assert.equal(limitRainSplashCount(29, 400), 29);
    assert.equal(limitRainSplashCount(29, 0), 0);
});
