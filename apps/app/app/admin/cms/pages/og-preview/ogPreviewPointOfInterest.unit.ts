import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOgImagePointOfInterest } from './ogPreviewPointOfInterest';

describe('parseOgImagePointOfInterest', () => {
    it('preserves the centered fallback when the coordinate is absent', () => {
        for (const value of [null, '', '   ']) {
            assert.equal(parseOgImagePointOfInterest(value), null);
        }
    });

    it('accepts integer percentages including the boundaries', () => {
        assert.equal(parseOgImagePointOfInterest('0'), 0);
        assert.equal(parseOgImagePointOfInterest(' 50 '), 50);
        assert.equal(parseOgImagePointOfInterest('100'), 100);
    });

    it('rejects invalid or out-of-range percentages', () => {
        for (const value of ['1.5', '-1', '101', 'center']) {
            assert.equal(parseOgImagePointOfInterest(value), null);
        }
    });
});
