import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { autumnAsterPots } from '@gredice/js/autumnAsterPots';
import { seasonalRoles } from '../scene/seasonalRoles';
import {
    potGlazeColors,
    potGlazeRoughness,
    potSoilColor,
    potSoilRoughness,
} from './potPalette';

// A sunlit top face shows its albedo times this gain, then Khronos neutral
// tone mapping (as assets/scripts/party_style.py models it).
const sunlitGain = 3.2;

function srgbToLinear(channel: number) {
    return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number) {
    const clamped = Math.min(1, Math.max(0, channel));
    return clamped <= 0.0031308
        ? clamped * 12.92
        : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

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

/** sRGB channels (0 to 1) a sunlit top face shows for this albedo hex. */
function onScreen(albedoHex: string) {
    const albedo = [1, 3, 5].map((index) =>
        srgbToLinear(
            Number.parseInt(albedoHex.slice(index, index + 2), 16) / 255,
        ),
    );
    return neutralToneMap(albedo.map((channel) => channel * sunlitGain)).map(
        linearToSrgb,
    );
}

function saturationAndValue(rgb: number[]) {
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    return { saturation: max === 0 ? 0 : (max - min) / max, value: max };
}

describe('pot palette', () => {
    it('glazes every pot in the gloss band over matte soil', () => {
        assert.equal(Object.keys(potGlazeColors).length, 10);
        assert.ok(potGlazeRoughness >= 0.25 && potGlazeRoughness <= 0.45);
        assert.ok(potSoilRoughness >= 0.75 && potSoilRoughness <= 0.85);
    });

    it('shows each glaze as a clean main-surface colour on screen', () => {
        for (const [name, color] of Object.entries(potGlazeColors)) {
            const { saturation, value } = saturationAndValue(onScreen(color));
            assert.ok(
                saturation >= 0.55 && saturation <= 0.85,
                `${name} saturation ${saturation.toFixed(2)}`,
            );
            assert.ok(
                value >= 0.7 && value <= 0.95,
                `${name} value ${value.toFixed(2)}`,
            );
        }
    });

    it('glazes the low bowl, the aster pot bowl, in the terracotta role', () => {
        assert.equal(
            potGlazeColors.PotLowBowl,
            seasonalRoles.terracotta.albedo,
        );
    });

    it('colours the autumn asters with the bright seasonal roles', () => {
        const roles = {
            AutumnAsterPotMauve: [
                seasonalRoles.asterViolet,
                seasonalRoles.autumnGold,
            ],
            AutumnAsterPotCream: [
                seasonalRoles.cream,
                seasonalRoles.autumnGold,
            ],
            AutumnAsterPotGold: [
                seasonalRoles.autumnGold,
                seasonalRoles.conker,
            ],
        };
        assert.equal(autumnAsterPots.length, Object.keys(roles).length);
        for (const item of autumnAsterPots) {
            const [petals, centre] = roles[item.name];
            assert.equal(item.color, petals.albedo, item.name);
            assert.equal(item.centerColor, centre.albedo, item.name);
        }
    });

    it('fills pots with the bed soil role', () => {
        const target = [0x8f, 0x55, 0x30].map((channel) => channel / 255);
        const shown = onScreen(potSoilColor);
        for (const [index, channel] of shown.entries()) {
            assert.ok(Math.abs(channel - target[index]) <= 2 / 255);
        }
    });
});
