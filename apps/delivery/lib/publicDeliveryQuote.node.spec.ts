import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createPublicDeliveryQuoteHandlers } from './publicDeliveryQuoteRoute';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
const { OPTIONS, POST } = createPublicDeliveryQuoteHandlers(async () => ({
    rateLimited: false,
}));

beforeEach(() => {
    process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = 'server-test-key';
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
        delete process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
    } else {
        process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = originalApiKey;
    }
});

function deliveryRequest(
    address: string,
    ipAddress: string,
    origin = 'https://www.gredice.com',
) {
    return new Request(
        'https://dostava.gredice.com/api/public/delivery-quote',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                origin,
                'x-vercel-forwarded-for': ipAddress,
            },
            body: JSON.stringify({ address }),
        },
    );
}

function googleMapsFetch({
    distanceMeters,
    latitude,
    longitude,
}: {
    distanceMeters: number;
    latitude: number;
    longitude: number;
}) {
    return async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.hostname === 'maps.googleapis.com') {
            return Response.json({
                status: 'OK',
                results: [
                    {
                        formatted_address: 'Testna ulica 1, Hrvatska',
                        address_components: [
                            { short_name: 'HR', types: ['country'] },
                        ],
                        geometry: {
                            location: { lat: latitude, lng: longitude },
                        },
                    },
                ],
            });
        }
        if (url.hostname === 'routes.googleapis.com') {
            const body = JSON.parse(String(init?.body));
            assert.deepEqual(body.origin.location.latLng, {
                latitude: 45.778683,
                longitude: 15.9837396,
            });
            assert.deepEqual(body.destination.location.latLng, {
                latitude,
                longitude,
            });
            return Response.json({ routes: [{ distanceMeters }] });
        }
        throw new Error(`Unexpected request to ${url.origin}`);
    };
}

test('returns a paid quote from Google driving distance with CORS headers', async () => {
    globalThis.fetch = googleMapsFetch({
        distanceMeters: 20_000,
        latitude: 45.7132,
        longitude: 16.0752,
    });

    const response = await POST(
        deliveryRequest('Testna ulica 1, Velika Gorica', '203.0.113.1'),
    );

    assert.equal(response.status, 200);
    assert.equal(
        response.headers.get('Access-Control-Allow-Origin'),
        'https://www.gredice.com',
    );
    assert.deepEqual(await response.json(), {
        distanceKilometres: 20,
        formattedAddress: 'Testna ulica 1, Hrvatska',
        isAvailable: true,
        isFree: false,
        price: 4,
    });
});

test('returns free delivery for an address inside the City of Zagreb', async () => {
    globalThis.fetch = googleMapsFetch({
        distanceMeters: 5_000,
        latitude: 45.778683,
        longitude: 15.9837396,
    });

    const response = await POST(
        deliveryRequest('Testna ulica 1, Zagreb', '203.0.113.2'),
    );
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.isAvailable, true);
    assert.equal(result.isFree, true);
    assert.equal(result.price, 0);
});

test('reports delivery as unavailable beyond 100 km of driving', async () => {
    globalThis.fetch = googleMapsFetch({
        distanceMeters: 100_100,
        latitude: 44.8666,
        longitude: 13.8496,
    });

    const response = await POST(
        deliveryRequest('Testna ulica 1, Pula', '203.0.113.7'),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        distanceKilometres: 100.1,
        formattedAddress: 'Testna ulica 1, Hrvatska',
        isAvailable: false,
        isFree: false,
        price: 0,
    });
});

test('handles preflight requests from production and preview origins', () => {
    const productionResponse = OPTIONS(
        new Request('https://dostava.gredice.com/api/public/delivery-quote', {
            method: 'OPTIONS',
            headers: { origin: 'https://www.gredice.com' },
        }),
    );
    const previewResponse = OPTIONS(
        new Request('https://dostava.gredice.com/api/public/delivery-quote', {
            method: 'OPTIONS',
            headers: {
                origin: 'https://33fa1ur95-preview-gredice.vercel.app',
            },
        }),
    );
    const customPreviewResponse = OPTIONS(
        new Request('https://dostava.gredice.com/api/public/delivery-quote', {
            method: 'OPTIONS',
            headers: {
                origin: 'https://www-feat-delivery-check.preview.gredice.com',
            },
        }),
    );

    assert.equal(productionResponse.status, 204);
    assert.equal(previewResponse.status, 204);
    assert.equal(customPreviewResponse.status, 204);
    assert.equal(
        previewResponse.headers.get('Access-Control-Allow-Origin'),
        'https://33fa1ur95-preview-gredice.vercel.app',
    );
    assert.equal(
        customPreviewResponse.headers.get('Access-Control-Allow-Origin'),
        'https://www-feat-delivery-check.preview.gredice.com',
    );
});

test('rejects invalid and unapproved-origin requests before calling Google', async () => {
    globalThis.fetch = async () => {
        throw new Error('Google must not be called');
    };

    const invalidAddressResponse = await POST(
        deliveryRequest('a', '203.0.113.3'),
    );
    const crossOriginResponse = await POST(
        deliveryRequest(
            'Testna ulica 1, Zagreb',
            '203.0.113.4',
            'https://example.com',
        ),
    );
    const spoofedPreviewResponse = await POST(
        deliveryRequest(
            'Testna ulica 1, Zagreb',
            '203.0.113.8',
            'https://www-branch.preview.gredice.com.example.com',
        ),
    );

    assert.equal(invalidAddressResponse.status, 400);
    assert.equal(crossOriginResponse.status, 403);
    assert.equal(spoofedPreviewResponse.status, 403);
});

test('returns a static not-found response without exposing Google details', async () => {
    globalThis.fetch = async () =>
        Response.json({ status: 'ZERO_RESULTS', results: [] });

    const response = await POST(
        deliveryRequest('Nepoznata adresa 123', '203.0.113.5'),
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Address not found.' });
});

test('returns the shared platform rate-limit response before calling Google', async () => {
    globalThis.fetch = async () => {
        throw new Error('Google must not be called');
    };
    const { POST: rateLimitedPost } = createPublicDeliveryQuoteHandlers(
        async () => ({ rateLimited: true }),
    );

    const response = await rateLimitedPost(
        deliveryRequest('Testna ulica 1, Zagreb', '203.0.113.6'),
    );

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.deepEqual(await response.json(), {
        error: 'Rate limit exceeded.',
    });
});
