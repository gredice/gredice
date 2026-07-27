import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultCartItemCurrency } from './sunflowerCalculations';

function cartItem({
    currency = 'eur',
    discountPrice,
    id,
    price,
    status = 'new',
}: {
    currency?: string;
    discountPrice?: number;
    id: number;
    price: number;
    status?: string;
}) {
    return {
        currency,
        id,
        shopData: {
            discountPrice,
            price,
        },
        status,
    };
}

test('defaults a new item to sunflowers when the balance covers the committed cart and new item', () => {
    assert.equal(
        getDefaultCartItemCurrency({
            availableSunflowers: 4_500,
            items: [
                cartItem({
                    currency: 'sunflower',
                    id: 1,
                    price: 2.5,
                }),
                cartItem({ id: 2, price: 2 }),
            ],
            newCartItemId: 2,
        }),
        'sunflower',
    );
});

test('defaults a new item to euros when it is affordable alone but not with sunflower cart commitments', () => {
    assert.equal(
        getDefaultCartItemCurrency({
            availableSunflowers: 4_000,
            items: [
                cartItem({
                    currency: 'sunflower',
                    id: 1,
                    price: 2.5,
                }),
                cartItem({ id: 2, price: 2 }),
            ],
            newCartItemId: 2,
        }),
        'eur',
    );
});

test('does not reserve sunflowers for items explicitly kept in euros or already paid', () => {
    assert.equal(
        getDefaultCartItemCurrency({
            availableSunflowers: 3_000,
            items: [
                cartItem({ id: 1, price: 4 }),
                cartItem({
                    currency: 'sunflower',
                    id: 2,
                    price: 5,
                    status: 'paid',
                }),
                cartItem({ id: 3, price: 2 }),
            ],
            newCartItemId: 3,
        }),
        'sunflower',
    );
});

test('uses the effective discounted price and requires a positive price', () => {
    assert.equal(
        getDefaultCartItemCurrency({
            availableSunflowers: 1_200,
            items: [cartItem({ discountPrice: 1.2, id: 1, price: 2 })],
            newCartItemId: 1,
        }),
        'sunflower',
    );
    assert.equal(
        getDefaultCartItemCurrency({
            availableSunflowers: 1_200,
            items: [cartItem({ id: 2, price: 0 })],
            newCartItemId: 2,
        }),
        'eur',
    );
});
