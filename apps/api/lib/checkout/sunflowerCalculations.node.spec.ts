import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateSunflowerAmount,
    calculateSunflowerReplayAmount,
    getDefaultCartItemCurrency,
} from './sunflowerCalculations';

function cartItem({
    amount = 1,
    currency = 'eur',
    discountPrice,
    id,
    price,
    status = 'new',
}: {
    amount?: number;
    currency?: string;
    discountPrice?: number;
    id: number;
    price: number;
    status?: string;
}) {
    return {
        amount,
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

test('prices every unit in a multi-quantity sunflower cart item', () => {
    const item = cartItem({ amount: 3, id: 1, price: 2 });

    assert.equal(calculateSunflowerAmount(item), 6_000);
    assert.equal(
        getDefaultCartItemCurrency({
            availableSunflowers: 5_999,
            items: [item],
            newCartItemId: item.id,
        }),
        'eur',
    );
    assert.equal(
        getDefaultCartItemCurrency({
            availableSunflowers: 6_000,
            items: [item],
            newCartItemId: item.id,
        }),
        'sunflower',
    );
});

test('reconstructs paid sunflower replay amounts without the paid-item zero discount', () => {
    assert.equal(
        calculateSunflowerReplayAmount({
            amount: 2,
            shopData: { discountPrice: 0, price: 2.5 },
            status: 'paid',
        }),
        5_000,
    );
    assert.equal(
        calculateSunflowerReplayAmount({
            amount: 2,
            outlet: { outletPrice: 1.2 },
            shopData: { discountPrice: 0, price: 2.5 },
            status: 'paid',
        }),
        2_400,
    );
    assert.equal(
        calculateSunflowerReplayAmount({
            amount: 2,
            shopData: { discountPrice: 1.4, price: 2.5 },
            status: 'new',
        }),
        2_800,
    );
});
