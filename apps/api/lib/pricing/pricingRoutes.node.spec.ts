import assert from 'node:assert/strict';
import test from 'node:test';
import { createPricingRoutes } from '../../app/api/[...route]/pricingRoutes';
import { GET as publish } from '../../app/api/internal/cron/publish-price-list/route';

test('public pricing responds without authentication and preserves unknown reference prices', async () => {
    const entries = [
        {
            key: 'plant:1',
            entityId: 1,
            entityTypeName: 'plant',
            name: 'Uzgoj rajčice',
            price: 5,
            currency: 'EUR',
            unit: 'biljka',
            available: true,
            specialSale: '',
            anchorPrice: null,
        },
    ];
    const response = await createPricingRoutes(async () => entries).request(
        '/',
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), entries);
});

test('failed pricing loads do not become a successful empty catalog', async () => {
    const route = createPricingRoutes(async () => {
        throw new Error('unavailable');
    });
    route.onError(() => new Response('Unavailable', { status: 503 }));
    const response = await route.request('/');
    assert.equal(response.status, 503);
});

test('price-list publication rejects unauthenticated requests even without a configured secret', async () => {
    const secret = process.env.CRON_SECRET;
    try {
        delete process.env.CRON_SECRET;
        assert.equal(
            (
                await publish(
                    new Request(
                        'https://api.example.test/api/internal/cron/publish-price-list',
                        { headers: { authorization: 'Bearer undefined' } },
                    ),
                )
            ).status,
            401,
        );
        process.env.CRON_SECRET = 'test-only-secret';
        assert.equal(
            (
                await publish(
                    new Request(
                        'https://api.example.test/api/internal/cron/publish-price-list',
                    ),
                )
            ).status,
            401,
        );
    } finally {
        if (secret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = secret;
    }
});
