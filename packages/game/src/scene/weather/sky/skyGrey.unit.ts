import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Color } from 'three';
import { resolveCoverDimmingShare } from '../../atmosphereLighting';
import { gameWeatherSkyGrey } from '../../gameArtStyle';
import { resolveSkyGradientColors } from '../../skyGradient';
import { resolveBandCover } from './cloudBand';
import {
    applyWeatherSkyGrey,
    applyWeatherSkyGreyToGradient,
    resolveWeatherSkyGrey,
    resolveWeatherSkyGreyAmount,
} from './skyGrey';

function luminance(color: Color) {
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/** HSL saturation of a linear colour as it shows on screen. */
function onScreenSaturation(color: Color) {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    return hsl.s;
}

const storm = { cloudy: 1, rainy: 1, thundery: 1, storm: 1 };
const midday = { midday: 1, sunset: 0, night: 0 };
const sunset = { midday: 0, sunset: 1, night: 0 };
const night = { midday: 0, sunset: 0, night: 1 };
const heavyRain = { cloudy: 0.85, rainy: 1 };
const lightRain = { cloudy: 0.85, rainy: 0.6 };

describe('rain and storm sky grey', () => {
    it('leaves clear, cloudy, fog and snow skies alone', () => {
        assert.equal(resolveWeatherSkyGreyAmount(undefined), 0);
        assert.equal(resolveWeatherSkyGreyAmount(null), 0);
        assert.equal(resolveWeatherSkyGreyAmount({ cloudy: 0 }), 0);
        assert.equal(resolveWeatherSkyGreyAmount({ cloudy: 0.4 }), 0);
        // Dry overcast, the fog preset and the snow preset.
        assert.equal(resolveWeatherSkyGreyAmount({ cloudy: 1 }), 0);
        assert.equal(resolveWeatherSkyGreyAmount({ cloudy: 0.2 }), 0);
        assert.equal(resolveWeatherSkyGreyAmount({ cloudy: 0.75 }), 0);
    });

    it('is full for heavy rain and storm from cover 0.75', () => {
        assert.equal(resolveWeatherSkyGreyAmount(heavyRain), 1);
        assert.equal(resolveWeatherSkyGreyAmount(storm), 1);
        assert.equal(
            resolveWeatherSkyGreyAmount({ cloudy: 0.75, rainy: 1 }),
            1,
        );
        // Thunder alone greys the sky like rain.
        assert.equal(
            resolveWeatherSkyGreyAmount({ cloudy: 1, thundery: 1 }),
            1,
        );
    });

    it('gives light rain part of it', () => {
        const amount = resolveWeatherSkyGreyAmount(lightRain);
        assert.ok(amount > 0.35 && amount < 0.7, `light rain: ${amount}`);
        assert.equal(
            resolveWeatherSkyGreyAmount({
                cloudy: 1,
                rainy: gameWeatherSkyGrey.rainRamp[0],
            }),
            0,
        );
    });

    it('follows the cover curve, so a low-cover shower keeps its colour', () => {
        for (const cloudy of [0, 0.2, 0.4, 0.6, 0.66, 0.75, 0.9]) {
            assert.equal(
                resolveWeatherSkyGreyAmount({ cloudy, rainy: 1 }),
                resolveCoverDimmingShare(cloudy),
            );
        }
        assert.ok(resolveWeatherSkyGreyAmount({ cloudy: 0.4, rainy: 1 }) < 0.2);
        let previous = -1;
        for (let cloudy = 0; cloudy <= 1.0001; cloudy += 0.05) {
            const amount = resolveWeatherSkyGreyAmount({ cloudy, rainy: 1 });
            assert.ok(amount >= previous, `monotone at ${cloudy}`);
            previous = amount;
        }
    });

    it('greys a storm by the deck it draws, not the cover reported', () => {
        // Thunder brings the deck at any cover (`resolveBandCover`), so a
        // thunderstorm reported as partly cloudy greys like an overcast one.
        const lowCoverStorm = { cloudy: 0.4, rainy: 0.9, thundery: 1 };
        assert.equal(resolveBandCover(lowCoverStorm.cloudy, 1), 0.86);
        assert.equal(resolveWeatherSkyGreyAmount(lowCoverStorm), 1);
        assert.equal(
            resolveWeatherSkyGreyAmount(lowCoverStorm),
            resolveWeatherSkyGreyAmount({ ...lowCoverStorm, cloudy: 0.85 }),
        );
        for (const cloudy of [0, 0.2, 0.4, 0.6, 0.75, 0.9]) {
            assert.equal(resolveWeatherSkyGreyAmount({ ...storm, cloudy }), 1);
        }
        // Dry thunder too; the shower beside it keeps its colour.
        assert.equal(
            resolveWeatherSkyGreyAmount({ cloudy: 0.3, thundery: 1 }),
            1,
        );
        assert.ok(
            resolveWeatherSkyGreyAmount({ cloudy: 0.4, rainy: 0.9 }) < 0.2,
        );
    });

    it('ramps a building storm with its damped amount and deck', () => {
        const cloudy = 0.4;
        let previous = -1;
        for (let amount = 0; amount <= 1.0001; amount += 0.1) {
            const grey = resolveWeatherSkyGreyAmount({
                cloudy,
                thundery: 1,
                storm: amount,
            });
            assert.ok(grey >= previous, `monotone at storm ${amount}`);
            assert.ok(
                grey <= amount + 1e-9,
                `no more than the storm ${amount}`,
            );
            previous = grey;
        }
        assert.equal(
            resolveWeatherSkyGreyAmount({ cloudy, thundery: 1, storm: 0 }),
            0,
        );
    });

    it('follows the damped storm amount over the thunder flag', () => {
        const half = resolveWeatherSkyGreyAmount({
            cloudy: 1,
            thundery: 1,
            storm: 0.5,
        });
        assert.equal(half, 0.5);
    });

    it('takes less colour at sunset and night, toward a rose and a slate grey', () => {
        const day = resolveWeatherSkyGrey(storm, midday);
        const dusk = resolveWeatherSkyGrey(storm, sunset);
        const dark = resolveWeatherSkyGrey(storm, night);
        assert.equal(day.amount, gameWeatherSkyGrey.dayStrength);
        assert.ok(
            Math.abs(dusk.amount - gameWeatherSkyGrey.sunsetStrength) < 1e-9,
        );
        assert.equal(dark.amount, gameWeatherSkyGrey.nightStrength);
        assert.ok(dusk.amount < day.amount);
        assert.ok(dark.amount < dusk.amount);
        assert.ok(day.tint.equals(new Color(gameWeatherSkyGrey.dayTint)));
        assert.ok(dark.tint.equals(new Color(gameWeatherSkyGrey.nightTint)));
        assert.ok(onScreenSaturation(dark.tint) > onScreenSaturation(day.tint));
        assert.ok(dark.tint.b > dark.tint.r);
        // Dusk leans rose, not brown: red and blue above green.
        assert.ok(dusk.tint.r > dusk.tint.g && dusk.tint.b > dusk.tint.g);
        assert.equal(
            resolveWeatherSkyGrey({ cloudy: 1 }, { ...midday, night: 0.5 })
                .amount,
            0,
        );
    });

    it('blends the times of day by their weights', () => {
        const half = resolveWeatherSkyGrey(storm, {
            midday: 0.5,
            sunset: 0,
            night: 0.5,
        });
        assert.ok(
            Math.abs(
                half.amount -
                    (gameWeatherSkyGrey.dayStrength +
                        gameWeatherSkyGrey.nightStrength) /
                        2,
            ) < 1e-9,
        );
        const dayTint = new Color(gameWeatherSkyGrey.dayTint);
        const nightTint = new Color(gameWeatherSkyGrey.nightTint);
        assert.ok(Math.abs(half.tint.b - (dayTint.b + nightTint.b) / 2) < 1e-9);
    });

    it('writes into a target without allocating', () => {
        const target = { amount: 0, tint: new Color() };
        const result = resolveWeatherSkyGrey(heavyRain, midday, target);
        assert.equal(result, target);
        assert.equal(result.amount, gameWeatherSkyGrey.dayStrength);
    });

    it('keeps luminance and takes saturation out', () => {
        const grey = resolveWeatherSkyGrey(storm, midday);
        for (const hex of ['#8a84de', '#aca6ee', '#dcd4f8', '#9fdaff']) {
            const color = new Color(hex);
            const before = color.clone();
            applyWeatherSkyGrey(color, grey);
            assert.ok(
                Math.abs(luminance(color) - luminance(before)) < 1e-3,
                `${hex} luminance`,
            );
            assert.ok(
                onScreenSaturation(color) < onScreenSaturation(before) * 0.6,
                `${hex} saturation`,
            );
            // A cool grey, not brown: blue stays at least red.
            assert.ok(color.b >= color.r, `${hex} stays cool`);
        }
    });

    it('changes nothing at a zero amount', () => {
        const color = new Color('#8a84de');
        const before = color.clone();
        applyWeatherSkyGrey(color, { amount: 0, tint: new Color('#ffffff') });
        assert.ok(color.equals(before));

        const gradient = resolveSkyGradientColors({
            backgroundColor: new Color('#9fdaff'),
            backgroundPaletteIndex: 0,
            moonlight: 0,
            timeOfDay: 0.5,
            weather: { cloudy: 0.85 },
        });
        assert.equal(
            applyWeatherSkyGreyToGradient(
                gradient,
                resolveWeatherSkyGrey({ cloudy: 0.85 }, midday),
            ),
            gradient,
        );
    });

    it('greys a storm gradient without touching the original', () => {
        const gradient = resolveSkyGradientColors({
            backgroundColor: new Color('#9fdaff'),
            backgroundPaletteIndex: 0,
            moonlight: 0,
            timeOfDay: 0.5,
            weather: storm,
        });
        const zenith = gradient.zenith.clone();
        const greyed = applyWeatherSkyGreyToGradient(
            gradient,
            resolveWeatherSkyGrey(storm, midday),
        );
        assert.ok(gradient.zenith.equals(zenith));
        for (const key of ['zenith', 'upper', 'horizon', 'lower'] as const) {
            assert.ok(
                onScreenSaturation(greyed[key]) <
                    onScreenSaturation(gradient[key]),
                key,
            );
        }
        assert.equal(greyed.sunGlowIntensity, gradient.sunGlowIntensity);
    });
});
