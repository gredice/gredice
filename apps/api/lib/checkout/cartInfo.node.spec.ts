import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getAbandonedRaisedBedCartNote,
    getEffectiveInventoryAvailability,
    getMinimumOrderNote,
    getNewRaisedBedPlantingNote,
    getPendingInventoryCartItemIds,
    getTotalCartValueCents,
    hasEnoughInventoryForCartItem,
} from './cartInfo';

const pendingInventoryItem = {
    id: 41,
    amount: 2,
    currency: 'inventory',
    entityId: '7',
    entityTypeName: 'plantSort',
    status: 'new',
};

const pendingInventoryConsumption = {
    cartItemId: 41,
    source: 'shoppingCartItem:41',
    entityId: '7',
    entityTypeName: 'plantSort',
    amount: 2,
};

describe('getEffectiveInventoryAvailability', () => {
    it('credits a matching pending checkout consumption back to availability', () => {
        const availability = getEffectiveInventoryAvailability(
            [pendingInventoryItem],
            [
                {
                    entityId: '7',
                    entityTypeName: 'plantSort',
                    amount: 1,
                },
            ],
            [pendingInventoryConsumption],
        );

        assert.strictEqual(availability.get('plantSort-7'), 3);
    });

    it('does not credit a completed checkout consumption', () => {
        const availability = getEffectiveInventoryAvailability(
            [{ ...pendingInventoryItem, status: 'paid' }],
            [
                {
                    entityId: '7',
                    entityTypeName: 'plantSort',
                    amount: 1,
                },
            ],
            [pendingInventoryConsumption],
        );

        assert.strictEqual(availability.get('plantSort-7'), 1);
    });

    it('rejects a mismatched checkout source', () => {
        assert.throws(
            () =>
                getEffectiveInventoryAvailability(
                    [pendingInventoryItem],
                    [],
                    [
                        {
                            ...pendingInventoryConsumption,
                            source: 'shoppingCartItem:42',
                        },
                    ],
                ),
            /source mismatch/,
        );
    });

    it('rejects a consumption for a different inventory item', () => {
        assert.throws(
            () =>
                getEffectiveInventoryAvailability(
                    [pendingInventoryItem],
                    [],
                    [
                        {
                            ...pendingInventoryConsumption,
                            entityId: '8',
                        },
                    ],
                ),
            /item mismatch/,
        );
    });

    it('rejects a consumption with a different amount', () => {
        assert.throws(
            () =>
                getEffectiveInventoryAvailability(
                    [pendingInventoryItem],
                    [],
                    [{ ...pendingInventoryConsumption, amount: 1 }],
                ),
            /amount mismatch/,
        );
    });
});

describe('getPendingInventoryCartItemIds', () => {
    it('skips inventory reads for sunflower-only and already-paid carts', () => {
        assert.deepStrictEqual(
            getPendingInventoryCartItemIds([
                { id: 1, currency: 'sunflower', status: 'new' },
                { id: 2, currency: 'inventory', status: 'paid' },
            ]),
            [],
        );
        assert.deepStrictEqual(
            getPendingInventoryCartItemIds([
                { id: 3, currency: 'inventory', status: 'new' },
            ]),
            [3],
        );
    });
});

describe('hasEnoughInventoryForCartItem', () => {
    it('does not reject a paid inventory item based on the current balance', () => {
        assert.strictEqual(
            hasEnoughInventoryForCartItem(
                { ...pendingInventoryItem, status: 'paid' },
                0,
            ),
            true,
        );
        assert.strictEqual(
            hasEnoughInventoryForCartItem(pendingInventoryItem, 1),
            false,
        );
    });
});

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
