import assert from 'node:assert/strict';
import test from 'node:test';
import { anchorPriceLabel } from './index';

test('unchanged prices do not show a reference note', () => {
    assert.equal(anchorPriceLabel(5, { price: 5, date: '2026-09-10' }), null);
    assert.equal(
        anchorPriceLabel(5.001, { price: 5.002, date: '2026-09-10' }),
        null,
    );
});

test('price lists can include unchanged anchor amounts and dates', () => {
    for (const current of [5, 5.001, 5.002]) {
        assert.equal(
            anchorPriceLabel(
                current,
                { price: 5, date: '2026-09-10' },
                { showUnchanged: true },
            ),
            'Cijena 10. 9. 2026.: 5,00\u00a0€',
        );
    }
    assert.equal(
        anchorPriceLabel(
            0,
            { price: 0, date: '2026-09-10' },
            { showUnchanged: true },
        ),
        'Cijena 10. 9. 2026.: 0,00\u00a0€',
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

for (const showUnchanged of [false, true]) {
    test(`missing or invalid history never produces a made-up reference (showUnchanged=${showUnchanged})`, () => {
        for (const anchor of [
            null,
            undefined,
            { price: Number.NaN, date: '2026-09-10' },
            { price: -1, date: '2026-09-10' },
            { price: 5, date: 'invalid' },
        ]) {
            assert.equal(anchorPriceLabel(5, anchor, { showUnchanged }), null);
        }
    });
}
