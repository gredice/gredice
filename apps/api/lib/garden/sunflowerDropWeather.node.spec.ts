import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { populateWeatherFromSymbol } from '../weather/populateWeatherFromSymbol';
import { isSunflowerDropWeatherEligible } from './sunflowerDropWeather';

function eligibilityForSymbol(symbol: number, rain = 0) {
    return isSunflowerDropWeatherEligible({
        ...populateWeatherFromSymbol(symbol),
        rain,
    });
}

describe('sunflower drop weather eligibility', () => {
    it('allows sunny and light-cloud garden visits', () => {
        assert.equal(eligibilityForSymbol(1), true);
        assert.equal(eligibilityForSymbol(2), true);
        assert.equal(eligibilityForSymbol(5), true);
    });

    it('rejects wetter, foggier, stormier, and too-cloudy visits', () => {
        assert.equal(eligibilityForSymbol(3), false);
        assert.equal(eligibilityForSymbol(8), false);
        assert.equal(eligibilityForSymbol(12), false);
        assert.equal(eligibilityForSymbol(16), false);
        assert.equal(eligibilityForSymbol(1, 0.06), false);
    });
});
