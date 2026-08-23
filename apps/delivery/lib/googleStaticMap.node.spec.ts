import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGoogleStaticMapUrl } from './googleStaticMap';

function withGoogleMapsServerApiKey<T>(run: () => T) {
    const originalApiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
    const originalSigningSecret =
        process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET;
    process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = 'test-key';
    delete process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET;

    try {
        return run();
    } finally {
        if (originalApiKey === undefined) {
            delete process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
        } else {
            process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY = originalApiKey;
        }
        if (originalSigningSecret === undefined) {
            delete process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET;
        } else {
            process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET =
                originalSigningSecret;
        }
    }
}

function markerValues(url: URL) {
    return url.searchParams.getAll('markers');
}

test('includes distinct pickup markers and the complete route in driver maps', () => {
    withGoogleMapsServerApiKey(() => {
        const encodedPolyline = 'driver-only-route';
        const url = buildGoogleStaticMapUrl({
            driverLocation: { latitude: 45.8, longitude: 15.9 },
            pickupNodes: [
                { latitude: 45.81, longitude: 15.91 },
                { latitude: 45.82, longitude: 15.92 },
            ],
            stops: [{ latitude: 45.83, longitude: 15.93, sequence: 1 }],
            encodedPolyline,
            customerView: false,
        });

        assert.ok(url);
        assert.deepEqual(markerValues(url), [
            'color:0x1d4ed8|label:V|45.8,15.9',
            'color:0xf59e0b|label:P|45.81,15.91',
            'color:0xf59e0b|label:P|45.82,15.92',
            'color:0x166534|label:1|45.83,15.93',
        ]);
        assert.equal(
            url.searchParams.get('path'),
            `color:0x166534dd|weight:5|enc:${encodedPolyline}`,
        );
    });
});

test('omits pickup markers and the full route from customer maps', () => {
    withGoogleMapsServerApiKey(() => {
        const pickupCoordinates = '45.81,15.91';
        const encodedPolyline = 'private-full-route';
        const url = buildGoogleStaticMapUrl({
            driverLocation: { latitude: 45.8, longitude: 15.9 },
            pickupNodes: [{ latitude: 45.81, longitude: 15.91 }],
            stops: [{ latitude: 45.83, longitude: 15.93, sequence: 4 }],
            encodedPolyline,
            customerView: true,
        });

        assert.ok(url);
        assert.deepEqual(markerValues(url), [
            'color:0x1d4ed8|label:V|45.8,15.9',
            'color:0xdc2626|label:C|45.83,15.93',
        ]);
        assert.equal(url.searchParams.has('path'), false);
        assert.equal(
            decodeURIComponent(url.toString()).includes(pickupCoordinates),
            false,
        );
        assert.equal(url.toString().includes(encodedPolyline), false);
    });
});

test('keeps oversized encoded routes out of static map URLs', () => {
    withGoogleMapsServerApiKey(() => {
        const url = buildGoogleStaticMapUrl({
            pickupNodes: [{ latitude: 45.81, longitude: 15.91 }],
            stops: [{ latitude: 45.83, longitude: 15.93 }],
            encodedPolyline: 'a'.repeat(8_000),
            customerView: false,
        });

        assert.ok(url);
        assert.equal(url.searchParams.has('path'), false);
    });
});

test('drops a route path when URL escaping would exceed the API limit', () => {
    withGoogleMapsServerApiKey(() => {
        const url = buildGoogleStaticMapUrl({
            pickupNodes: [{ latitude: 45.81, longitude: 15.91 }],
            stops: [{ latitude: 45.83, longitude: 15.93 }],
            encodedPolyline: '?'.repeat(7_999),
            customerView: false,
        });

        assert.ok(url);
        assert.equal(url.searchParams.has('path'), false);
        assert.ok(url.toString().length <= 16_384);
    });
});

test('does not reuse a browser key for server-side static maps', () => {
    const originalBrowserApiKey = process.env.GREDICE_GOOGLE_MAPS_API_KEY;
    const originalServerApiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
    process.env.GREDICE_GOOGLE_MAPS_API_KEY = 'browser-key';
    delete process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;

    try {
        const url = buildGoogleStaticMapUrl({
            stops: [{ latitude: 45.83, longitude: 15.93 }],
            customerView: true,
        });

        assert.equal(url, null);
    } finally {
        if (originalBrowserApiKey === undefined) {
            delete process.env.GREDICE_GOOGLE_MAPS_API_KEY;
        } else {
            process.env.GREDICE_GOOGLE_MAPS_API_KEY = originalBrowserApiKey;
        }
        if (originalServerApiKey === undefined) {
            delete process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY;
        } else {
            process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY =
                originalServerApiKey;
        }
    }
});
