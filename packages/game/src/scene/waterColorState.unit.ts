import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    defaultWaterColors,
    type LinearRgb,
    litWaterSurfaceAlbedo,
    litWaterSurfaceRoughness,
    waterAlbedoPalette,
    waterGlintStrength,
    waterSurfaceSheenCap,
} from './waterColorState';

// A sunlit top face shows its albedo times this gain, then Khronos neutral
// tone mapping (as assets/scripts/party_style.py models it).
const sunlitGain = 3.2;

function linearToSrgb(channel: number) {
    const clamped = Math.min(1, Math.max(0, channel));
    return clamped <= 0.0031308
        ? clamped * 12.92
        : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

/** three.js NeutralToneMapping (Khronos PBR neutral). */
function neutralToneMap(color: number[]) {
    const start = 0.8 - 0.04;
    const desaturation = 0.15;
    const lowest = Math.min(...color);
    const offset = lowest < 0.08 ? lowest - 6.25 * lowest * lowest : 0.04;
    const shifted = color.map((channel) => channel - offset);
    const peak = Math.max(...shifted);
    if (peak < start) return shifted;
    const d = 1 - start;
    const newPeak = 1 - (d * d) / (peak + d - start);
    const scaled = shifted.map((channel) => (channel * newPeak) / peak);
    const g = 1 - 1 / (desaturation * (peak - newPeak) + 1);
    return scaled.map((channel) => channel * (1 - g) + newPeak * g);
}

/** sRGB channels (0 to 1) a top face with this albedo shows under `light`. */
function shown(albedo: LinearRgb, light: LinearRgb = [1, 1, 1]) {
    return neutralToneMap(
        albedo.map((channel, index) => channel * sunlitGain * light[index]),
    ).map(linearToSrgb);
}

function channels(hex: string) {
    return [1, 3, 5].map(
        (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
    );
}

function hsv(rgb: number[]) {
    const [red, green, blue] = rgb;
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    const delta = max - min;
    let hue = 0;
    if (delta > 0) {
        if (max === red) hue = ((green - blue) / delta) % 6;
        else if (max === green) hue = (blue - red) / delta + 2;
        else hue = (red - green) / delta + 4;
    }
    return {
        h: (hue * 60 + 360) % 360,
        s: max === 0 ? 0 : delta / max,
        v: max,
    };
}

function assertShowsHex(albedo: LinearRgb, hex: string) {
    const actual = shown(albedo);
    const target = channels(hex);
    for (const [index, channel] of actual.entries()) {
        assert.ok(
            Math.abs(channel - target[index]) <= 3 / 255,
            `${albedo.join(',')} shows ${actual.map((c) => Math.round(c * 255)).join(',')} instead of ${hex}`,
        );
    }
}

describe('water albedo palette', () => {
    it('shows the water role on a sunlit top face at midday', () => {
        const role = hsv(channels(defaultWaterColors.shallow));
        const water = hsv(shown(waterAlbedoPalette.standard.shallow));

        assert.equal(defaultWaterColors.shallow, '#35b4ff');
        assert.ok(Math.abs(water.h - role.h) <= 5, JSON.stringify(water));
        assert.ok(Math.abs(water.s - role.s) <= 0.05, JSON.stringify(water));
        assert.ok(Math.abs(water.v - role.v) <= 0.06, JSON.stringify(water));
    });

    it('shows the deep and bank colours of the midday palette', () => {
        assertShowsHex(
            waterAlbedoPalette.standard.deep,
            defaultWaterColors.deep,
        );
        assertShowsHex(
            waterAlbedoPalette.standard.foam,
            defaultWaterColors.foam,
        );
    });

    it('keeps the main water tones saturated and light', () => {
        for (const albedo of [
            waterAlbedoPalette.standard.shallow,
            waterAlbedoPalette.standard.deep,
            waterAlbedoPalette.swamp.shallow,
            waterAlbedoPalette.swamp.deep,
        ]) {
            const color = hsv(shown(albedo));
            assert.ok(
                color.s >= 0.55 && color.s <= 0.85,
                JSON.stringify(color),
            );
            assert.ok(color.v >= 0.65, JSON.stringify(color));
        }

        // The bank edge is a light, tinted neutral, never pure white.
        const bank = hsv(shown(waterAlbedoPalette.standard.foam));
        assert.ok(bank.s >= 0.1 && bank.s <= 0.3, JSON.stringify(bank));
    });

    it('keeps water sides a clean mid blue, not a heavy royal blue', () => {
        // A lit side gets about 0.6 of the top's light and a shaded side
        // about 0.4 (GAME_ART.md); a low sun can light a side fully.
        const sideLight = (amount: number): LinearRgb => [
            amount,
            amount,
            amount,
        ];

        for (const amount of [0.4, 0.6, 1]) {
            const side = hsv(
                shown(waterAlbedoPalette.standard.side, sideLight(amount)),
            );
            assert.ok(side.h > 200 && side.h < 220, JSON.stringify(side));
            assert.ok(
                side.s >= 0.55 && side.s <= 0.85,
                JSON.stringify({ amount, side }),
            );
            assert.ok(side.v >= 0.65, JSON.stringify({ amount, side }));
        }
        assertShowsHex(waterAlbedoPalette.standard.side, '#69acf7');

        const swampSide = hsv(
            shown(waterAlbedoPalette.swamp.side, sideLight(0.6)),
        );
        assert.ok(
            swampSide.h > 150 && swampSide.h < 180,
            JSON.stringify(swampSide),
        );
        assert.ok(
            swampSide.s >= 0.55 && swampSide.s <= 0.85,
            JSON.stringify(swampSide),
        );

        // A shaded swamp side stays at least as light as rich soil.
        const shadedSwampSide = hsv(
            shown(waterAlbedoPalette.swamp.side, sideLight(0.4)),
        );
        assert.ok(shadedSwampSide.v >= 0.55, JSON.stringify(shadedSwampSide));
    });

    it('keeps shaded sides in range under the cool midday side fill', () => {
        // The light a shaded side gets in the game at midday, fitted from a
        // screenshot of a lone block: about 0.4 of the top's, tinted cool.
        const coolShade: LinearRgb = [0.32, 0.34, 0.43];
        const side = hsv(shown(waterAlbedoPalette.standard.side, coolShade));
        const swampSide = hsv(shown(waterAlbedoPalette.swamp.side, coolShade));

        assert.ok(side.s >= 0.55 && side.s <= 0.85, JSON.stringify(side));
        assert.ok(side.v >= 0.7, JSON.stringify(side));
        assert.ok(swampSide.s <= 0.85, JSON.stringify(swampSide));
        assert.ok(swampSide.v >= 0.55, JSON.stringify(swampSide));
    });

    it('turns swamp water clean green-teal with yellow-green algae', () => {
        assertShowsHex(waterAlbedoPalette.swamp.shallow, '#47bd99');
        assertShowsHex(waterAlbedoPalette.swamp.deep, '#36ad90');
        assertShowsHex(waterAlbedoPalette.swamp.foam, '#d4f0b4');
        assertShowsHex(waterAlbedoPalette.swamp.algae, '#8ccf3a');

        for (const albedo of [
            waterAlbedoPalette.swamp.shallow,
            waterAlbedoPalette.swamp.deep,
        ]) {
            const color = hsv(shown(albedo));
            assert.ok(color.h > 145 && color.h < 190, JSON.stringify(color));
        }

        const algae = hsv(shown(waterAlbedoPalette.swamp.algae));
        assert.ok(algae.h > 70 && algae.h < 110, JSON.stringify(algae));
        assert.ok(algae.s >= 0.55 && algae.v >= 0.7, JSON.stringify(algae));
    });

    it('stays clearly blue and light under a dim blue-violet night fill', () => {
        // A night fill at about a third of midday, tinted blue-violet.
        const nightLight: LinearRgb = [0.16, 0.16, 0.5];
        const water = hsv(
            shown(waterAlbedoPalette.standard.shallow, nightLight),
        );
        const grass = hsv(shown([0.0744, 0.2096, 0.0257], nightLight));

        assert.ok(water.h > 200 && water.h < 240, JSON.stringify(water));
        assert.ok(water.s >= 0.7, JSON.stringify(water));
        assert.ok(water.v >= 0.6, JSON.stringify(water));
        // Water does not sink below the grass around it.
        assert.ok(water.v > grass.v, JSON.stringify({ grass, water }));
    });

    it('lights prop water with the same albedo and a wet roughness', () => {
        assert.deepEqual(
            litWaterSurfaceAlbedo,
            waterAlbedoPalette.standard.shallow,
        );
        assert.ok(litWaterSurfaceRoughness >= 0.1);
        assert.ok(litWaterSurfaceRoughness <= 0.2);
    });

    it('caps the sun highlight on a water top to a soft sheen', () => {
        // Added on top of the sunlit water, the capped highlight must leave
        // the pond clearly blue instead of flashing it white.
        const sunlit = waterAlbedoPalette.standard.shallow.map(
            (channel) => channel * sunlitGain,
        );
        const withSheen = hsv(
            neutralToneMap(
                sunlit.map((channel) => channel + waterSurfaceSheenCap),
            ).map(linearToSrgb),
        );

        assert.ok(waterSurfaceSheenCap > 0, String(waterSurfaceSheenCap));
        assert.ok(withSheen.h > 190 && withSheen.h < 215);
        assert.ok(withSheen.s >= 0.55, JSON.stringify(withSheen));
    });

    it('keeps the drifting glint a soft sheen, not a milky patch', () => {
        // The shader mixes the water toward the bank colour by up to this
        // much where the glint peaks. A glint can cover a whole single tile,
        // so at its peak the tile must still read as clean saturated water.
        const { foam, shallow } = waterAlbedoPalette.standard;
        const peak = shallow.map(
            (channel, index) =>
                channel * (1 - waterGlintStrength) +
                (foam[index] ?? 0) * waterGlintStrength,
        );
        const water = hsv(shown(shallow));
        const glint = hsv(shown([peak[0] ?? 0, peak[1] ?? 0, peak[2] ?? 0]));

        assert.ok(waterGlintStrength > 0, String(waterGlintStrength));
        // Still visibly lighter than the water around it...
        assert.ok(water.s - glint.s >= 0.05, JSON.stringify({ glint, water }));
        // ...but saturated and blue.
        assert.ok(glint.s >= 0.65, JSON.stringify(glint));
        assert.ok(Math.abs(glint.h - water.h) <= 5, JSON.stringify(glint));
    });
});
