import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { blockExpandCopy } from '../blockOptionsCopy';
import {
    type ExpandAffordabilityInput,
    isExpandAlertInStatus,
    resolveExpandAffordability,
    resolveExpandStatusMessage,
} from './expandAffordability';

const base: ExpandAffordabilityInput = {
    count: 6,
    unitPrice: 10,
    balance: 1000,
    isSandbox: false,
    isAccountLoading: false,
    isAvailableNow: true,
    isPlaceable: true,
};

describe('resolveExpandAffordability', () => {
    it('totals the copies and confirms when the balance covers them', () => {
        assert.deepEqual(resolveExpandAffordability(base), {
            total: 60,
            affordableCount: 100,
            canAfford: true,
            canConfirm: true,
            statusMessage: null,
        });
    });

    it('confirms when the balance covers the total exactly', () => {
        const result = resolveExpandAffordability({ ...base, balance: 60 });
        assert.equal(result.canConfirm, true);
        assert.equal(result.affordableCount, 6);
    });

    it('says how many copies the balance covers when it is short', () => {
        const result = resolveExpandAffordability({ ...base, balance: 35 });
        assert.equal(result.total, 60);
        assert.equal(result.affordableCount, 3);
        assert.equal(result.canAfford, false);
        assert.equal(result.canConfirm, false);
        assert.equal(
            result.statusMessage,
            'Nedovoljno suncokreta. Imaš dovoljno za 3 bloka.',
        );
    });

    it('uses the short message without a count when nothing is affordable', () => {
        for (const balance of [9, 0, -40]) {
            const result = resolveExpandAffordability({ ...base, balance });
            assert.equal(result.affordableCount, 0, String(balance));
            assert.equal(result.canConfirm, false);
            assert.equal(result.statusMessage, 'Nedovoljno suncokreta.');
        }
    });

    it('is free in a sandbox whatever the balance', () => {
        const result = resolveExpandAffordability({
            ...base,
            isSandbox: true,
            balance: null,
            unitPrice: 25,
        });
        assert.deepEqual(result, {
            total: 0,
            affordableCount: 6,
            canAfford: true,
            canConfirm: true,
            statusMessage: null,
        });
    });

    it('waits for the account and shows no short message meanwhile', () => {
        const loading = resolveExpandAffordability({
            ...base,
            balance: undefined,
            isAccountLoading: true,
        });
        assert.equal(loading.canConfirm, false);
        assert.equal(loading.statusMessage, null);
        assert.equal(loading.affordableCount, 0);

        const stale = resolveExpandAffordability({
            ...base,
            balance: 1000,
            isAccountLoading: true,
        });
        assert.equal(stale.canConfirm, false);
    });

    it('cannot confirm an empty plan or while a batch is pending', () => {
        assert.equal(
            resolveExpandAffordability({ ...base, count: 0 }).canConfirm,
            false,
        );
        assert.equal(
            resolveExpandAffordability({ ...base, pending: true }).canConfirm,
            false,
        );
        assert.equal(
            resolveExpandAffordability({ ...base, count: 0 }).statusMessage,
            null,
        );
    });

    it('explains blocks that cannot be bought now', () => {
        const night = resolveExpandAffordability({
            ...base,
            isAvailableNow: false,
        });
        assert.equal(night.canConfirm, false);
        assert.equal(night.statusMessage, 'Dostupno samo noću.');

        const notForSale = resolveExpandAffordability({
            ...base,
            isPlaceable: false,
            unitPrice: 0,
        });
        assert.equal(notForSale.canConfirm, false);
        assert.equal(notForSale.statusMessage, 'Ovaj predmet se ne prodaje.');
    });

    it('ignores fractional or invalid counts and prices', () => {
        const result = resolveExpandAffordability({
            ...base,
            count: 2.7,
            unitPrice: Number.NaN,
        });
        assert.equal(result.total, 0);
        assert.equal(result.affordableCount, 2);
    });
});

describe('resolveExpandStatusMessage', () => {
    const plan = { count: 6, width: 4, depth: 2, maxSide: 10 };
    const none = { statusMessage: null };

    it('asks to drag the handle while only the source is marked', () => {
        assert.equal(
            resolveExpandStatusMessage({
                affordability: none,
                count: 0,
                width: 1,
                depth: 1,
                maxSide: 10,
            }),
            'Povuci ručku da označiš područje.',
        );
    });

    it('explains a rectangle with every cell skipped', () => {
        assert.equal(
            resolveExpandStatusMessage({
                affordability: none,
                count: 0,
                width: 3,
                depth: 1,
                maxSide: 10,
            }),
            'Sva označena polja su zauzeta ili na drugoj visini.',
        );
    });

    it('shows the cap once a side reaches it', () => {
        assert.equal(
            resolveExpandStatusMessage({
                affordability: none,
                ...plan,
                width: 5,
                maxSide: 5,
            }),
            'Najviše 5 × 5 polja odjednom.',
        );
        assert.equal(
            resolveExpandStatusMessage({ affordability: none, ...plan }),
            null,
        );
    });

    it('puts availability first, then emptiness, then a short balance, then the cap', () => {
        assert.equal(
            resolveExpandStatusMessage({
                affordability: { statusMessage: blockExpandCopy.nightOnly },
                count: 0,
                width: 1,
                depth: 1,
                maxSide: 10,
            }),
            'Dostupno samo noću.',
        );
        assert.equal(
            resolveExpandStatusMessage({
                affordability: { statusMessage: blockExpandCopy.short(2) },
                ...plan,
                width: 10,
            }),
            'Nedovoljno suncokreta. Imaš dovoljno za 2 bloka.',
        );
        assert.equal(
            resolveExpandStatusMessage({
                affordability: { statusMessage: blockExpandCopy.notForSale },
                ...plan,
            }),
            'Ovaj predmet se ne prodaje.',
        );
    });
});

describe('isExpandAlertInStatus', () => {
    it('hides an alert the status line repeats or details', () => {
        // The server's short-balance answer, then the refreshed HUD balance.
        assert.equal(
            isExpandAlertInStatus(
                blockExpandCopy.short(0),
                blockExpandCopy.short(3),
            ),
            true,
        );
        assert.equal(
            isExpandAlertInStatus(
                blockExpandCopy.short(0),
                blockExpandCopy.short(0),
            ),
            true,
        );
    });

    it('keeps an alert the status line does not cover', () => {
        assert.equal(
            isExpandAlertInStatus(blockExpandCopy.short(0), null),
            false,
        );
        assert.equal(
            isExpandAlertInStatus(
                blockExpandCopy.priceChanged,
                blockExpandCopy.short(3),
            ),
            false,
        );
        assert.equal(
            isExpandAlertInStatus(
                blockExpandCopy.short(0),
                blockExpandCopy.cap(10),
            ),
            false,
        );
    });
});
