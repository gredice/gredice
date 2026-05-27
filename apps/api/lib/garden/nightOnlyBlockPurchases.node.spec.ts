import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBlockPurchaseAvailableNow } from './nightOnlyBlockPurchases';

const zagreb = { lat: 45.815, lon: 15.9819 };

describe('isBlockPurchaseAvailableNow', () => {
    it('allows ordinary blocks at any time', () => {
        assert.equal(
            isBlockPurchaseAvailableNow({
                block: { attributes: { nightOnlyPurchase: false } },
                currentTime: new Date('2026-06-21T12:00:00+02:00'),
                location: zagreb,
            }),
            true,
        );
    });

    it('blocks night-only purchases during daylight', () => {
        assert.equal(
            isBlockPurchaseAvailableNow({
                block: { attributes: { nightOnlyPurchase: true } },
                currentTime: new Date('2026-06-21T12:00:00+02:00'),
                location: zagreb,
            }),
            false,
        );
    });

    it('allows night-only purchases after sunset', () => {
        assert.equal(
            isBlockPurchaseAvailableNow({
                block: { attributes: { nightOnlyPurchase: true } },
                currentTime: new Date('2026-06-21T23:30:00+02:00'),
                location: zagreb,
            }),
            true,
        );
    });
});
