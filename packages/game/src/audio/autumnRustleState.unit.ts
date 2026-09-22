import assert from 'node:assert/strict';
import test from 'node:test';
import { getAutumnState } from '../scene/autumnState';
import {
    autumnRustleMaxGain,
    resolveAutumnRustleTarget,
} from './autumnRustleState';

const autumn = getAutumnState({
    season: 'autumn',
    progress: 0.5,
    phase: 'mid',
    yearPhase: 0.8,
});
const defaults = {
    windSpeed: 1,
    season: 'autumn',
    autumn,
    hasTrees: true,
    enabled: true,
} as const;
const gain = (
    options: Partial<Parameters<typeof resolveAutumnRustleTarget>[0]> = {},
) => resolveAutumnRustleTarget({ ...defaults, ...options });

test('summer, no foliage, absent trees, calm and disabled audio are silent', () => {
    for (const options of [
        { season: 'summer' as const },
        { hasTrees: false },
        { windSpeed: 0 },
        { windSpeed: Number.NaN },
        { enabled: false },
        { autumn: { ...autumn, leafRetention: 0, settledLeafAmount: 0 } },
    ])
        assert.equal(gain(options), 0);
});
test('wind and seasonal presence map into a quiet bounded mixer target', () => {
    assert(gain({ windSpeed: 0.7 }) > 0);
    assert(gain({ windSpeed: 2.4 }) > gain({ windSpeed: 0.7 }));
    assert(gain({ windSpeed: 300 }) <= autumnRustleMaxGain);
    assert(
        gain({
            autumn: { ...autumn, leafRetention: 0.1, settledLeafAmount: 0.1 },
        }) < gain(),
    );
});
test('hysteresis survives threshold jitter and resets when a scene becomes ineligible', () => {
    assert.equal(gain({ windSpeed: 0.4 }), 0);
    let previousGain = gain({ windSpeed: 0.5 });
    for (const windSpeed of [0.4, 0.43, 0.35, 0.42]) {
        previousGain = gain({ windSpeed, previousGain });
        assert(previousGain > 0);
    }
    assert.equal(gain({ windSpeed: 0.29, previousGain }), 0);
    assert.equal(gain({ season: 'summer', previousGain }), 0);
    assert.equal(gain({ enabled: false, previousGain }), 0);
});
