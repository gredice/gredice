import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import type { GardenPackOffer } from './gardenPackCatalogue';
import {
    getGardenPackIndividualTotal,
    projectGardenPackOffer,
} from './gardenPackCatalogueRead';

function offer(): GardenPackOffer {
    return {
        sale: { enabled: true, availableFrom: null, availableUntil: null },
        snapshot: {
            contractVersion: 1,
            productId: 'test-only',
            productVersionId: 'test-only:v1',
            name: { hr: 'Test' },
            description: { hr: 'Testna ponuda' },
            previews: ['https://example.test/pack.png'],
            currency: 'sunflower',
            chargedSunflowers: 11,
            publication: 'published',
            availableFrom: null,
            availableUntil: null,
            policy: {
                versionId: 'policy:v1',
                refunds: 'unused-units-paid-value',
                recycling: 'configured-per-unit-value',
                seasonExpiry: 'retain-owned-units',
                gardenDeletion: 'recycle-placed-units-once',
                accountDeletion: 'detach-owner-retain-audit',
            },
            lines: [
                {
                    lineId: 'pumpkins',
                    entityId: '123',
                    modelName: 'HarvestPumpkinSquatOrange',
                    variant: null,
                    quantity: 2,
                    paidSunflowersByUnit: [5, 6],
                    recyclingSunflowersByUnit: [2, 3],
                },
            ],
        },
    };
}
function block(): BlockData {
    return {
        id: 123,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: 'test-pumpkin',
        information: {
            name: 'HarvestPumpkinSquatOrange',
            label: 'Bundeva',
            shortDescription: '',
            fullDescription: '',
        },
        attributes: {
            type: 'decoration',
            height: 1,
            stackable: false,
            nightOnlyPurchase: false,
        },
        functions: { raisedBed: false, recycler: false },
        prices: { sunflowers: 10 },
        createdAt: '2026-10-02T00:00:00Z',
        updatedAt: '2026-10-02T00:00:00Z',
    };
}
const now = new Date('2026-10-02T12:00:00Z');
test('projection quotes exact immutable contents and current positive individual sum', () => {
    const projected = projectGardenPackOffer(offer(), [block()], now);
    assert.equal(projected.available, true);
    assert.equal(projected.individualTotalSunflowers, 20);
    assert.equal(projected.lines[0]?.quantity, 2);
    assert.equal(projected.lines[0]?.variant, null);
    assert.deepEqual(projected.quote, {
        productVersionId: 'test-only:v1',
        chargedSunflowers: 11,
        currency: 'sunflower',
    });
});
test('invalid, duplicated and unsupported catalogue contents omit comparisons and cannot be bought', () => {
    for (const blocks of [
        [],
        [block(), block()],
        [{ ...block(), id: 124 }],
        [{ ...block(), prices: { sunflowers: 0 } }],
        [
            {
                ...block(),
                attributes: { ...block().attributes, type: 'building' },
            },
        ],
    ]) {
        const projected = projectGardenPackOffer(offer(), blocks, now);
        assert.equal(projected.available, false);
        assert.equal(projected.individualTotalSunflowers, null);
    }
    for (const price of [0, -1, 1.1, Number.NaN, Number.POSITIVE_INFINITY])
        assert.equal(
            getGardenPackIndividualTotal(offer(), [
                { ...block(), prices: { sunflowers: price } },
            ]),
            null,
        );
});
test('sale and snapshot windows independently disable new purchases', () => {
    for (const part of ['sale', 'snapshot'] as const) {
        const expired = offer();
        expired[part].availableUntil = '2026-10-01T00:00:00Z';
        assert.equal(
            projectGardenPackOffer(expired, [block()], now).unavailableReason,
            'expired',
        );
        const scheduled = offer();
        scheduled[part].availableFrom = '2026-10-03T00:00:00Z';
        assert.equal(
            projectGardenPackOffer(scheduled, [block()], now).unavailableReason,
            'scheduled',
        );
    }
    const disabled = offer();
    disabled.sale.enabled = false;
    assert.equal(
        projectGardenPackOffer(disabled, [block()], now).unavailableReason,
        'disabled',
    );
});
