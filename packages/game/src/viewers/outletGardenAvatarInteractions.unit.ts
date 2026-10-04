import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldOpenOutletGardenOfferModal } from './outletGardenAvatarInteractions';

describe('Outlet garden avatar interactions', () => {
    it('opens aimed plant details while the avatar is walking', () => {
        assert.equal(
            shouldOpenOutletGardenOfferModal({
                avatarWalking: true,
                offerListOpen: false,
                selectedOfferId: 302,
            }),
            true,
        );
    });

    it('keeps the overview-only offer list closed while walking', () => {
        assert.equal(
            shouldOpenOutletGardenOfferModal({
                avatarWalking: true,
                offerListOpen: true,
                selectedOfferId: null,
            }),
            false,
        );
    });
});
