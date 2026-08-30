import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { openAPIRouteHandler } from 'hono-openapi';
import {
    createDeliveryMobileRoutes,
    createTestDeliveryMobileAuthMiddleware,
    type DeliveryMobileRouteDeps,
} from '../../app/api/[...route]/deliveryMobileRoutes';
import type { DeliveryMobileProjectionResult } from './mobileActiveRoute';

function noRouteResult(): DeliveryMobileProjectionResult {
    return {
        response: {
            schemaVersion: 1,
            generatedAt: '2026-08-28T10:00:00.000Z',
            route: null,
        },
        omittedInvalidNodeCount: 0,
    };
}

function activeRouteResult(): DeliveryMobileProjectionResult {
    return {
        response: {
            schemaVersion: 1,
            generatedAt: '2026-08-28T10:00:00.000Z',
            route: {
                id: 'route:opaque',
                revision: 7,
                state: 'active',
                reroutePending: false,
                currentNavigationId: 'delivery:opaque',
                stops: [
                    {
                        navigationId: 'delivery:opaque',
                        kind: 'delivery',
                        sequence: 3,
                        actionState: 'current',
                        label: 'Dostava 3',
                        address: 'Odredišna adresa',
                        latitude: 45.8,
                        longitude: 16,
                        estimatedArrivalAt: '2026-08-28T10:10:00.000Z',
                        travelSeconds: 420,
                        distanceMeters: 5_100,
                    },
                ],
            },
        },
        omittedInvalidNodeCount: 0,
    };
}

function routeDeps({
    enabled = true,
    result = noRouteResult(),
    readActiveRoute,
    recordRead = () => undefined,
    onUnexpectedError = () => undefined,
}: {
    enabled?: boolean;
    result?: DeliveryMobileProjectionResult;
    readActiveRoute?: DeliveryMobileRouteDeps['readActiveRoute'];
    recordRead?: DeliveryMobileRouteDeps['recordRead'];
    onUnexpectedError?: DeliveryMobileRouteDeps['onUnexpectedError'];
} = {}): DeliveryMobileRouteDeps {
    return {
        enabled: () => enabled,
        authValidator: createTestDeliveryMobileAuthMiddleware(),
        now: () => new Date('2026-08-28T10:00:00.000Z'),
        readActiveRoute: readActiveRoute ?? (async () => result),
        recordRead,
        onUnexpectedError,
    };
}

test('disabled Android Auto route fails closed before reading driver data', async () => {
    let readCount = 0;
    const app = createDeliveryMobileRoutes(
        routeDeps({
            enabled: false,
            readActiveRoute: async () => {
                readCount += 1;
                return activeRouteResult();
            },
        }),
    );

    const response = await app.request('/active-route');

    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), {
        error: 'Android Auto trenutačno nije dostupan.',
        code: 'ANDROID_AUTO_DISABLED',
    });
    assert.equal(readCount, 0);
});

test('active-route derives its driver exclusively from native auth context', async () => {
    const inputs: Array<{ userId: string; generatedAt: Date }> = [];
    const app = createDeliveryMobileRoutes(
        routeDeps({
            readActiveRoute: async (input) => {
                inputs.push(input);
                return noRouteResult();
            },
        }),
    );

    const response = await app.request(
        '/active-route?userId=attacker&driverId=attacker&runId=run&accountId=other',
    );
    assert.equal(response.status, 200);
    assert.deepEqual(inputs, [
        {
            userId: 'driver-user',
            generatedAt: new Date('2026-08-28T10:00:00.000Z'),
        },
    ]);
    assert.deepEqual(await response.json(), noRouteResult().response);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('etag') ?? '', /^"[A-Za-z0-9_-]+"$/);
});

test('active-route returns 304 only for the same subject-bound visible projection', async () => {
    const app = createDeliveryMobileRoutes(
        routeDeps({ result: activeRouteResult() }),
    );
    const first = await app.request('/active-route');
    assert.equal(first.status, 200);
    const etag = first.headers.get('etag');
    assert.ok(etag);

    const unchanged = await app.request('/active-route', {
        headers: { 'If-None-Match': `"other", W/${etag}` },
    });
    assert.equal(unchanged.status, 304);
    assert.equal(await unchanged.text(), '');
    assert.equal(unchanged.headers.get('cache-control'), 'private, no-store');
    assert.equal(unchanged.headers.get('etag'), etag);
});

test('active-route emits privacy-safe read events', async () => {
    const events: unknown[] = [];
    const app = createDeliveryMobileRoutes(
        routeDeps({
            result: activeRouteResult(),
            recordRead: (event) => events.push(event),
        }),
    );

    const response = await app.request('/active-route');
    assert.equal(response.status, 200);
    assert.equal(events.length, 1);
    const serializedEvent = JSON.stringify(events[0]);
    for (const forbidden of [
        'driver-user',
        'driver-account',
        'Odredišna adresa',
        'delivery:opaque',
        'Dostava 3',
        'latitude',
        'longitude',
    ]) {
        assert.doesNotMatch(serializedEvent, new RegExp(forbidden, 'i'));
    }
});

test('active-route maps projection failures to a stable private 503', async () => {
    const failures: unknown[] = [];
    const events: unknown[] = [];
    const app = createDeliveryMobileRoutes(
        routeDeps({
            readActiveRoute: async () => {
                throw new Error('private storage detail');
            },
            recordRead: (event) => events.push(event),
            onUnexpectedError: () => failures.push('reported'),
        }),
    );

    const response = await app.request('/active-route');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), {
        error: 'Ruta trenutačno nije dostupna.',
        code: 'ROUTE_TEMPORARILY_UNAVAILABLE',
    });
    assert.equal(failures.length, 1);
    assert.equal(events.length, 1);
    assert.doesNotMatch(JSON.stringify(events[0]), /private storage detail/);
});

test('active-route OpenAPI declares the versioned response and stable errors', async () => {
    const routes = createDeliveryMobileRoutes(routeDeps());
    const docs = new Hono().get(
        '/docs',
        openAPIRouteHandler(routes, {
            documentation: {
                info: { title: 'Delivery Mobile API', version: '1.0.0' },
            },
        }),
    );
    const response = await docs.request('/docs');
    assert.equal(response.status, 200);
    const specification = await response.json();
    assert.equal(
        specification.paths['/active-route'].get.responses['200'].content[
            'application/json'
        ].schema.properties.schemaVersion.const,
        1,
    );
    assert.deepEqual(
        Object.keys(specification.paths['/active-route'].get.responses).sort(),
        ['200', '304', '401', '403', '503'],
    );
    assert.deepEqual(specification.paths['/active-route'].get.security, [
        { bearerAuth: [] },
    ]);
});
