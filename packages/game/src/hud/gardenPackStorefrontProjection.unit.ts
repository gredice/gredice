import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenPackOfferFixture } from '../../tests/gardenPackStorefrontFixture';
import {
    getGardenPackComparison,
    getReviewedGardenPackPreview,
    readStoredGardenPackCommand,
} from './gardenPackStorefrontProjection';

test('reviewed artwork requires exact included quantities and separates all scenery', () => {
    const offer = createGardenPackOfferFixture();
    const preview = getReviewedGardenPackPreview(offer);
    assert.ok(preview);
    assert.equal(
        preview.scenery.reduce((sum, item) => sum + item.quantity, 0),
        21,
    );
    assert.equal(
        offer.lines.reduce((sum, item) => sum + item.quantity, 0),
        4,
    );
    assert.equal(
        getReviewedGardenPackPreview({
            ...offer,
            previews: [
                'https://unreviewed.example/assets/arrangements/harvest-corner.png',
            ],
        }),
        undefined,
    );
    assert.equal(
        getReviewedGardenPackPreview({ ...offer, lines: offer.lines.slice(1) }),
        undefined,
    );
    assert.equal(
        getReviewedGardenPackPreview({
            ...offer,
            lines: offer.lines.map((line) => ({ ...line, quantity: 2 })),
        }),
        undefined,
    );
    assert.equal(
        getReviewedGardenPackPreview({
            ...offer,
            previews: ['https://example.com/arbitrary.png'],
        }),
        undefined,
    );
    assert.equal(
        getReviewedGardenPackPreview({
            ...offer,
            lines: offer.lines.map((line) => ({
                ...line,
                variant: { versionId: 'unknown', appearance: {} },
            })),
        }),
        undefined,
    );
});

test('comparison omits invalid totals and reports only the actual arithmetic', () => {
    const offer = createGardenPackOfferFixture();
    assert.deepEqual(getGardenPackComparison(offer), { total: 20, saving: 9 });
    assert.deepEqual(
        getGardenPackComparison({ ...offer, individualTotalSunflowers: 5 }),
        { total: 5, saving: -6 },
    );
    for (const total of [
        null,
        0,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        1.1,
    ])
        assert.equal(
            getGardenPackComparison({
                ...offer,
                individualTotalSunflowers: total,
            }),
            null,
        );
});

test('pending browser recovery keeps only validated immutable command fields', () => {
    const command = {
        operationId: '00000000-0000-4000-8000-000000000001',
        expectedAccountId: '00000000-0000-4000-8000-000000000010',
        productId: 'fixture',
        quote: {
            productVersionId: 'fixture:v1',
            chargedSunflowers: 11,
            currency: 'sunflower',
        },
    };
    assert.deepEqual(
        readStoredGardenPackCommand({
            ...command,
            accountId: 'untrusted',
            lines: [],
        }),
        command,
    );
    for (const invalid of [
        null,
        {},
        { ...command, operationId: 'bad' },
        { ...command, productId: '' },
        { ...command, quote: { ...command.quote, chargedSunflowers: 0 } },
        { ...command, quote: { ...command.quote, currency: 'eur' } },
    ])
        assert.equal(readStoredGardenPackCommand(invalid), null);
});
