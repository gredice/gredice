import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBlockPurchaseAvailableNow } from './nightOnlyBlockPurchases';

const zagreb = { lat: 45.815, lon: 15.9819 };

describe('isBlockPurchaseAvailableNow', () => {
    it('allows ordinary blocks at any time', () => {
        assert.equal(
            isBlockPurchaseAvailableNow({
                blockName: 'Bucket',
                currentTime: new Date('2026-06-21T12:00:00+02:00'),
                location: zagreb,
            }),
            true,
        );
    });

    it('blocks FireflyJar purchases during daylight', () => {
        assert.equal(
            isBlockPurchaseAvailableNow({
                blockName: 'FireflyJar',
                currentTime: new Date('2026-06-21T12:00:00+02:00'),
                location: zagreb,
            }),
            false,
        );
    });

    it('allows FireflyJar purchases after sunset', () => {
        assert.equal(
            isBlockPurchaseAvailableNow({
                blockName: 'FireflyJar',
                currentTime: new Date('2026-06-21T23:30:00+02:00'),
                location: zagreb,
            }),
            true,
        );
    });
});
