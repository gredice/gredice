import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Color } from 'three';
import {
    resolveWeatherRoles,
    resolveWeatherRoleTimeWeights,
    resolveWeatherToneWeights,
    weatherRoleSets,
} from './weatherRoles';

// Visual times of day the debug profile resolves for 12:00, 20:15 and 22:30.
const midday = 0.466;
const sunset = 0.79;
const night = 0.908;

function hex(color: Color) {
    return `#${color.getHexString('srgb')}`;
}

function hsvSaturation(hexColor: string) {
    const value = Number.parseInt(hexColor.slice(1), 16);
    const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    const max = Math.max(...channels);
    const min = Math.min(...channels);
    return max === 0 ? 0 : (max - min) / max;
}

describe('weather colour roles', () => {
    it('uses the midday, sunset and night sets at those times', () => {
        assert.deepEqual(resolveWeatherRoleTimeWeights(midday), {
            midday: 1,
            sunset: 0,
            night: 0,
        });
        const dusk = resolveWeatherRoleTimeWeights(sunset);
        assert.ok(dusk.sunset > 0.99, `sunset weight ${dusk.sunset}`);
        assert.deepEqual(resolveWeatherRoleTimeWeights(night), {
            midday: 0,
            sunset: 0,
            night: 1,
        });

        const noon = resolveWeatherRoles(midday, {});
        assert.equal(hex(noon.cloudLit), weatherRoleSets.midday.cloudFair[0]);
        assert.equal(hex(noon.cloudShade), weatherRoleSets.midday.cloudFair[1]);
        assert.equal(hex(noon.rainHead), '#a2dcff');
        assert.equal(hex(noon.boltFace), '#ffd31c');
        assert.equal(noon.cloudShadowStrength, 0.85);

        const late = resolveWeatherRoles(night, {});
        assert.equal(hex(late.rainHead), '#e0f2ff');
        assert.equal(hex(late.mist), '#b2b0f0');
        assert.equal(hex(late.stormSky[0]), '#574bb6');
        assert.equal(late.cloudShadowStrength, 0.5);
    });

    it('blends dawn and dusk so the weights always add up to one', () => {
        let sawDawn = false;
        let sawDusk = false;
        for (let step = 0; step <= 200; step += 1) {
            const time = step / 200;
            const weights = resolveWeatherRoleTimeWeights(time);
            const total = weights.midday + weights.sunset + weights.night;
            assert.ok(Math.abs(total - 1) < 1e-9, `total ${total} at ${time}`);
            if (time < 0.5 && weights.sunset > 0.5) sawDawn = true;
            if (time > 0.5 && weights.sunset > 0.5) sawDusk = true;
        }
        assert.ok(sawDawn && sawDusk, 'dawn and dusk both warm up');
    });

    it('moves the cloud body toward the weather tones like the target', () => {
        assert.deepEqual(resolveWeatherToneWeights({ cloudy: 0.4 }), {
            overcast: resolveWeatherToneWeights({ cloudy: 0.4 }).overcast,
            rain: 0,
            snow: 0,
            storm: 0,
        });
        assert.ok(resolveWeatherToneWeights({ cloudy: 0.4 }).overcast < 0.1);
        const overcast = resolveWeatherRoles(midday, { cloudy: 0.92 });
        assert.equal(hex(overcast.cloudLit), '#eceafd');
        assert.equal(hex(overcast.cloudShade), '#a6acec');
        const storm = resolveWeatherRoles(midday, {
            cloudy: 1,
            rainy: 1,
            storm: 1,
        });
        assert.equal(hex(storm.cloudLit), '#ddd6fb');
        assert.equal(hex(storm.cloudShade), '#968ce2');
        const snow = resolveWeatherRoles(night, { cloudy: 0.75, snowy: 0.9 });
        assert.equal(hex(snow.cloudLit), '#d4d6fa');
        // A storm that is still fading in sits between rain and storm.
        const fading = resolveWeatherRoles(midday, {
            cloudy: 1,
            rainy: 1,
            storm: 0.5,
        });
        assert.notEqual(hex(fading.cloudShade), hex(storm.cloudShade));
    });

    it('keeps every role light and coloured, never white or grey', () => {
        for (const set of Object.values(weatherRoleSets)) {
            for (const [lit, shade] of [
                set.cloudFair,
                set.cloudOvercast,
                set.cloudRain,
                set.cloudStorm,
                set.cloudSnow,
            ]) {
                assert.notEqual(lit, '#ffffff');
                assert.ok(hsvSaturation(lit) < hsvSaturation(shade));
                const shadeSaturation = hsvSaturation(shade);
                // GAME_ART asks 0.2 to 0.45; its own night storm shade
                // #7e72d2 sits at 0.457.
                assert.ok(
                    shadeSaturation >= 0.2 && shadeSaturation <= 0.46,
                    `shade ${shade} saturation ${shadeSaturation}`,
                );
            }
            for (const mist of [set.mist, set.mistLow]) {
                const saturation = hsvSaturation(mist);
                assert.ok(
                    saturation >= 0.1 && saturation <= 0.35,
                    `mist ${mist} saturation ${saturation}`,
                );
            }
        }
    });
});
