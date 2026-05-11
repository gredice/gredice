import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { populateWeatherFromSymbol } from './populateWeatherFromSymbol';

describe('populateWeatherFromSymbol', () => {
    it('covers representative symbols', () => {
        assert.deepEqual(populateWeatherFromSymbol(1), {
            cloudy: 0,
            rainy: 0,
            snowy: 0,
            foggy: 0,
            thundery: 0,
        });
        assert.equal(populateWeatherFromSymbol(12).rainy, 0.33);
        assert.equal(populateWeatherFromSymbol(21).snowy, 1);
        assert.equal(populateWeatherFromSymbol(8).foggy, 1);
        assert.equal(populateWeatherFromSymbol(16).thundery, 1);
        assert.equal(populateWeatherFromSymbol(999).cloudy, 0);
    });
});
