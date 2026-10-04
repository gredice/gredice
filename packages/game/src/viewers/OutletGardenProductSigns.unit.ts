import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OutletOfferData } from '../hooks/useOutletOffers';
import { getOutletGardenProductSignProducts } from './OutletGardenProductSigns';

function offer(
    id: number,
    plantSortId: number,
    overrides: Omit<Partial<OutletOfferData>, 'plantSort'> & {
        plantSort?: Partial<OutletOfferData['plantSort']>;
    } = {},
): OutletOfferData {
    const { plantSort, ...offerOverrides } = overrides;

    return {
        comparePrice: 3.99,
        endAt: '2026-08-20T00:00:00.000Z',
        id,
        imageUrls: [],
        initialPlantStatus: 'sprouted',
        outletPrice: 2.49,
        plantSort: {
            description: null,
            id: plantSortId,
            imageUrl: null,
            name: `Sort ${plantSortId.toString()}`,
            plant: null,
            ...plantSort,
        },
        quantity: 2,
        remainingQuantity: 2,
        reservedQuantity: 0,
        soldQuantity: 0,
        sowingDate: '2026-06-12T00:00:00.000Z',
        startAt: '2026-08-10T00:00:00.000Z',
        url: `https://www.gredice.test/outlet?offer=${id.toString()}`,
        ...offerOverrides,
    };
}

describe('getOutletGardenProductSignProducts', () => {
    it('builds one stable sign per scene plant sort', () => {
        const products = getOutletGardenProductSignProducts([
            offer(302, 102),
            offer(301, 101),
            offer(303, 101, { outletPrice: 2.49 }),
            offer(304, 103, { remainingQuantity: 0 }),
        ]);

        assert.deepEqual(
            products.map((product) => product.plantSortId),
            [101, 102, 103],
        );
        assert.equal(products[0]?.name, 'Sort 101');
        assert.equal(products[0]?.priceLabel, '2,49 €');
        assert.equal(products[2]?.priceLabel, 'Rasprodano');
    });

    it('shows the minimum price when same-sort offers have different prices', () => {
        const products = getOutletGardenProductSignProducts([
            offer(303, 101, { outletPrice: 2.19 }),
            offer(301, 101, { outletPrice: 2.49 }),
        ]);

        assert.equal(products[0]?.priceLabel, 'od 2,19 €');
    });

    it('prefers the sort image over deterministic offer-image fallback', () => {
        const sortImageProducts = getOutletGardenProductSignProducts([
            offer(303, 101, {
                imageUrls: ['https://example.test/offer-303.png'],
            }),
            offer(301, 101, {
                imageUrls: ['https://example.test/offer-301.png'],
            }),
            offer(302, 101, {
                plantSort: {
                    imageUrl: 'https://example.test/sort.png',
                },
            }),
        ]);
        const fallbackProducts = getOutletGardenProductSignProducts([
            offer(303, 101, {
                imageUrls: ['https://example.test/offer-303.png'],
            }),
            offer(301, 101, {
                imageUrls: ['https://example.test/offer-301.png'],
            }),
        ]);

        assert.equal(
            sortImageProducts[0]?.imageUrl,
            'https://example.test/sort.png',
        );
        assert.equal(
            fallbackProducts[0]?.imageUrl,
            'https://example.test/offer-301.png',
        );
        assert.equal(
            getOutletGardenProductSignProducts([offer(301, 101)])[0]?.imageUrl,
            null,
        );
    });
});
