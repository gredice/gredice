import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    EntityStandardized,
    OutletOfferWithAvailability,
} from '@gredice/storage';
import { createOutletRoutes } from '../../app/api/[...route]/outletRoutes';

function offer(): OutletOfferWithAvailability {
    return {
        id: 1,
        plantSortId: 101,
        sowingDate: new Date(),
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPriceCents: 100,
        comparePriceCents: 200,
        quantity: 5,
        remainingQuantity: 3,
        reservedQuantity: 1,
        soldQuantity: 1,
        startAt: new Date(Date.now() - 60_000),
        endAt: new Date(Date.now() + 60_000),
        status: 'published',
        adminNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
    };
}

test('empty offer variants skip catalogue work while checking current availability each time', async () => {
    const includes: boolean[] = [];
    const route = createOutletRoutes({
        listOffers: async ({ includeSoldOut = false } = {}) => {
            includes.push(includeSoldOut);
            return [];
        },
        loadPlantSorts: async () => {
            throw new Error('Empty offers must not load catalogue');
        },
    });
    for (const query of ['', '?includeSoldOut=true']) {
        const response = await route.request(`/offers${query}`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { items: [] });
        assert.match(response.headers.get('cache-control') ?? '', /s-maxage=0/);
    }
    assert.deepEqual(includes, [false, true]);
    assert.equal(
        (await route.request('/offers?includeSoldOut=invalid')).status,
        400,
    );
    assert.equal(includes.length, 2);
});

test('missing, expired and sold-out details do not load the catalogue', async () => {
    for (const item of [
        null,
        { ...offer(), remainingQuantity: 0 },
        { ...offer(), endAt: new Date(0) },
    ]) {
        const route = createOutletRoutes({
            findOffer: async () => item,
            loadPlantSorts: async () => {
                throw new Error('Unavailable offer must not load catalogue');
            },
        });
        assert.equal((await route.request('/offers/1')).status, 404);
    }
});

test('nonempty offers load the catalogue once and preserve live quantity and price', async () => {
    const item = offer();
    const plantSort: EntityStandardized = {
        id: 101,
        information: { name: 'Sadnica' },
    };
    let loads = 0;
    const route = createOutletRoutes({
        listOffers: async () => [item, { ...item, id: 2 }],
        findOffer: async () => item,
        loadPlantSorts: async () => {
            loads++;
            return new Map([[101, plantSort]]);
        },
    });
    const list = await route.request('/offers');
    assert.equal(list.status, 200);
    const body = await list.json();
    assert.equal(body.items.length, 2);
    assert.equal(body.items[0].remainingQuantity, 3);
    assert.equal(body.items[0].outletPrice, 1);
    assert.equal(loads, 1);
    assert.equal((await route.request('/offers/1')).status, 200);
    assert.equal(loads, 2);
});

test('availability failures remain failures rather than cached empty offers', async () => {
    const route = createOutletRoutes({
        listOffers: async () => {
            throw new Error('Unavailable');
        },
    });
    route.onError(() => new Response('Unavailable', { status: 503 }));
    assert.equal((await route.request('/offers')).status, 503);
});
