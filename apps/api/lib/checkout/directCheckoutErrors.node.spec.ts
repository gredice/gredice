import assert from 'node:assert/strict';
import test from 'node:test';
import {
    InsufficientSunflowersError,
    SunflowerSpendAmountConflictError,
} from '@gredice/storage';
import { getDirectCheckoutPaymentErrorResponse } from './directCheckoutErrors';

test('direct checkout maps insufficient balance to an explicit recoverable conflict', () => {
    assert.deepStrictEqual(
        getDirectCheckoutPaymentErrorResponse(
            new InsufficientSunflowersError(1_000, 2_000),
        ),
        {
            body: {
                code: 'INSUFFICIENT_SUNFLOWERS',
                error: 'Nema dovoljno suncokreta za ovu kupnju.',
            },
            errorCategory: 'sunflower_insufficient',
            status: 409,
        },
    );
});

test('direct checkout maps changed durable amount to an explicit conflict', () => {
    assert.deepStrictEqual(
        getDirectCheckoutPaymentErrorResponse(
            new SunflowerSpendAmountConflictError(
                'shoppingCartItem:1',
                2_000,
                3_000,
            ),
        ),
        {
            body: {
                code: 'SUNFLOWER_SPEND_CONFLICT',
                error: 'Cijena stavke promijenila se tijekom obrade. Osvježi košaricu i pokušaj ponovno.',
            },
            errorCategory: 'sunflower_amount_conflict',
            status: 409,
        },
    );
});

test('direct checkout does not hide infrastructure or fulfillment failures', () => {
    assert.equal(
        getDirectCheckoutPaymentErrorResponse(new Error('database offline')),
        null,
    );
});
