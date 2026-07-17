import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getAbandonedRaisedBedCartNote,
    getMinimumOrderNote,
    getNewRaisedBedPlantingNote,
    getTotalCartValueCents,
} from './cartInfo';

describe('getNewRaisedBedPlantingNote', () => {
    it('uses singular raised-bed copy for two raised-bed blocks', () => {
        assert.strictEqual(
            getNewRaisedBedPlantingNote(8, 2),
            'Potrebno je još 8 biljaka u ovoj gredici za postavljanje nove gredice.',
        );
    });

    it('uses plural raised-bed copy for multiple raised beds', () => {
        assert.strictEqual(
            getNewRaisedBedPlantingNote(18, 4),
            'Potrebno je još 18 biljaka u novim gredicama za postavljanje novih gredica.',
        );
    });
});

describe('getAbandonedRaisedBedCartNote', () => {
    it('explains that abandoned raised beds cannot receive new work', () => {
        assert.strictEqual(
            getAbandonedRaisedBedCartNote('Gredica 12'),
            'Gredica 12 je napuštena zbog neaktivnosti. Nove sjetve i radnje više nisu dostupne za ovu gredicu.',
        );
    });
});

describe('getMinimumOrderNote', () => {
    it('blocks positive totals below one euro', () => {
        assert.strictEqual(
            getMinimumOrderNote(99),
            'Minimalna vrijednost narudžbe je 1 €.',
        );
    });

    it('allows an empty total and totals of at least one euro', () => {
        assert.strictEqual(getMinimumOrderNote(0), null);
        assert.strictEqual(getMinimumOrderNote(100), null);
        assert.strictEqual(getMinimumOrderNote(101), null);
    });
});

describe('getTotalCartValueCents', () => {
    it('sums cent-denominated line items without floating-point drift', () => {
        const totalCartValueCents = getTotalCartValueCents([
            {
                amount: 1,
                currency: 'eur',
                shopData: { price: 0.06 },
                status: 'new',
            },
            {
                amount: 1,
                currency: 'eur',
                shopData: { price: 0.57 },
                status: 'new',
            },
            {
                amount: 1,
                currency: 'eur',
                shopData: { price: 0.37 },
                status: 'new',
            },
        ]);

        assert.strictEqual(totalCartValueCents, 100);
        assert.strictEqual(getMinimumOrderNote(totalCartValueCents), null);
    });
});
