import assert from 'node:assert/strict';
import test from 'node:test';
import { anchorPriceLabel } from './index';

test('unchanged prices show the reference date without a second amount', () => {
    assert.equal(
        anchorPriceLabel(5, { price: 5, date: '2026-09-10' }),
        'Ista cijena kao 10. 9. 2026.',
    );
    assert.equal(
        anchorPriceLabel(5.001, { price: 5.002, date: '2026-09-10' }),
        'Ista cijena kao 10. 9. 2026.',
    );
});

test('both increases and decreases display the historical price', () => {
    for (const current of [4, 6]) {
        assert.equal(
            anchorPriceLabel(current, { price: 5, date: '2026-09-10' }),
            'Cijena 10. 9. 2026.: 5,00\u00a0€',
        );
    }
    assert.equal(
        anchorPriceLabel(2, { price: 1, date: '2025-05-02' }),
        'Cijena 2. 5. 2025.: 1,00\u00a0€',
    );
});

test('missing or invalid history never produces a made-up reference', () => {
    assert.equal(anchorPriceLabel(5, null), null);
    assert.equal(anchorPriceLabel(5, undefined), null);
    assert.equal(
        anchorPriceLabel(5, { price: Number.NaN, date: '2026-09-10' }),
        null,
    );
    assert.equal(anchorPriceLabel(5, { price: -1, date: '2026-09-10' }), null);
    assert.equal(anchorPriceLabel(5, { price: 5, date: 'invalid' }), null);
});
