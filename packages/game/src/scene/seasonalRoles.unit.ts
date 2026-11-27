import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    autumnCanopyStops,
    seasonalEmissive,
    seasonalRoles,
} from './seasonalRoles';

const partyStylePath = fileURLToPath(
    new URL('../../../../assets/scripts/party_style.py', import.meta.url),
);

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

function channels(hex: string) {
    return [1, 3, 5].map(
        (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
    );
}

/** sRGB channels (0 to 1) a sunlit top face shows for this albedo hex. */
function onScreen(albedoHex: string) {
    const albedo = channels(albedoHex).map(srgbToLinear);
    return neutralToneMap(albedo.map((channel) => channel * sunlitGain)).map(
        linearToSrgb,
    );
}

function saturationAndValue(rgb: number[]) {
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    return { saturation: max === 0 ? 0 : (max - min) / max, value: max };
}

function snakeCase(name: string) {
    return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** `name: ("#hex", roughness)` entries of one dict in party_style.py. */
function readPythonRoles(dictName: string) {
    const source = readFileSync(partyStylePath, 'utf8');
    const start = source.indexOf(`${dictName} = {`);
    assert.ok(start >= 0, `${dictName} is missing from party_style.py`);
    const body = source.slice(start, source.indexOf('\n}', start));
    const roles = new Map<string, { screen: string; roughness: number }>();
    for (const match of body.matchAll(
        /"([a-z_]+)": \("(#[0-9a-f]{6})", ([0-9.]+)\)/g,
    )) {
        roles.set(match[1], {
            screen: match[2],
            roughness: Number(match[3]),
        });
    }
    return roles;
}

function readPythonEmissive() {
    const source = readFileSync(partyStylePath, 'utf8');
    const start = source.indexOf('SEASONAL_EMISSIVE = {');
    const body = source.slice(start, source.indexOf('\n}', start));
    return new Map(
        Array.from(body.matchAll(/"([a-z_]+)": "(#[0-9a-f]{6})"/g), (match) => [
            match[1],
            match[2],
        ]),
    );
}

const neutralRoles = new Set([
    'cream',
    'iron',
    'ghostLilac',
    'snow',
    'blossomWhite',
]);
// Small facial features may sit at the rich-soil value floor of about 0.55.
const accentRoles = new Set(['inkViolet']);

describe('seasonal roles', () => {
    it('match SEASONAL_ROLES in party_style.py', () => {
        const python = readPythonRoles('SEASONAL_ROLES');
        assert.equal(python.size, Object.keys(seasonalRoles).length);
        for (const [name, role] of Object.entries(seasonalRoles)) {
            const expected = python.get(snakeCase(name));
            assert.ok(expected, `${name} is missing from party_style.py`);
            assert.equal(role.screen, expected.screen, name);
            assert.equal(role.roughness, expected.roughness, name);
        }
    });

    it('match SEASONAL_EMISSIVE in party_style.py', () => {
        const python = readPythonEmissive();
        assert.equal(python.size, Object.keys(seasonalEmissive).length);
        for (const [name, color] of Object.entries(seasonalEmissive)) {
            assert.equal(python.get(snakeCase(name)), color, name);
        }
    });

    it('do not reuse a base role name', () => {
        const base = readPythonRoles('SCREEN_ROLES');
        assert.ok(base.size > 0);
        for (const name of Object.keys(seasonalRoles)) {
            assert.ok(!base.has(snakeCase(name)), name);
        }
    });

    it('show their on-screen colour from their albedo', () => {
        for (const [name, role] of Object.entries(seasonalRoles)) {
            const target = channels(role.screen);
            const shown = onScreen(role.albedo);
            for (const [index, channel] of shown.entries()) {
                assert.ok(
                    Math.abs(channel - target[index]) <= 2 / 255,
                    `${name} shows ${shown.map((c) => Math.round(c * 255))}, wants ${role.screen}`,
                );
            }
        }
    });

    it('stay bright and saturated on screen', () => {
        for (const [name, role] of Object.entries(seasonalRoles)) {
            const { saturation, value } = saturationAndValue(
                channels(role.screen),
            );
            assert.ok(value >= 0.55, `${name} value ${value.toFixed(2)}`);
            if (accentRoles.has(name)) continue;
            if (neutralRoles.has(name)) {
                assert.ok(
                    saturation >= 0.1 && saturation <= 0.25,
                    `${name} saturation ${saturation.toFixed(2)}`,
                );
                continue;
            }
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

    it('use a GAME_ART roughness band and no metalness', () => {
        for (const [name, role] of Object.entries(seasonalRoles)) {
            const r = role.roughness;
            const inBand =
                (r >= 0.1 && r <= 0.2) ||
                (r >= 0.25 && r <= 0.45) ||
                (r >= 0.5 && r <= 0.6) ||
                (r >= 0.75 && r <= 0.85);
            assert.ok(inBand, `${name} roughness ${r}`);
            assert.ok(!('metalness' in role), name);
        }
    });

    it('turn autumn canopies gold, amber, orange and red', () => {
        assert.deepEqual(autumnCanopyStops, [
            seasonalRoles.autumnGold.albedo,
            seasonalRoles.autumnAmber.albedo,
            seasonalRoles.autumnOrange.albedo,
            seasonalRoles.autumnRed.albedo,
        ]);
        const hues = autumnCanopyStops.map((albedo) => {
            const [r, g, b] = onScreen(albedo);
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            assert.equal(max, r, 'every stop is warm');
            return ((g - b) / (max - min)) * 60;
        });
        for (let index = 1; index < hues.length; index++) {
            assert.ok(hues[index] < hues[index - 1], 'hue moves toward red');
        }
    });
});
