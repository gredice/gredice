import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isAllowedTrackingEventSourceUrl,
    isAllowedTrackingOrigin,
} from './trackingOrigin.ts';

const canonicalRequest = new URL('https://www.gredice.com/api/tracking');
const apexOrigin = new URL('https://gredice.com');

test('accepts an apex Origin after the tracking POST is redirected to WWW', () => {
    assert.notEqual(apexOrigin.origin, canonicalRequest.origin);
    assert.equal(isAllowedTrackingOrigin(apexOrigin, canonicalRequest), true);
    assert.equal(
        isAllowedTrackingEventSourceUrl(
            new URL('https://gredice.com/biljke'),
            canonicalRequest,
            apexOrigin,
        ),
        true,
    );
});

test('rejects other cross-origin tracking requests', () => {
    for (const origin of [
        'https://vrt.gredice.com',
        'https://gredice.com.evil.example',
        'https://unrelated.example',
        'http://gredice.com',
        'https://gredice.com:8443',
    ]) {
        assert.equal(
            isAllowedTrackingOrigin(new URL(origin), canonicalRequest),
            false,
            origin,
        );
    }

    assert.equal(
        isAllowedTrackingOrigin(
            new URL('https://www.gredice.com'),
            new URL('https://gredice.com/api/tracking'),
        ),
        false,
    );
});

test('keeps same-origin and matching local development requests working', () => {
    assert.equal(
        isAllowedTrackingOrigin(
            new URL('https://www.gredice.com'),
            canonicalRequest,
        ),
        true,
    );
    assert.equal(
        isAllowedTrackingOrigin(
            new URL('https://preview.example'),
            new URL('https://preview.example/api/tracking'),
        ),
        true,
    );
    assert.equal(
        isAllowedTrackingOrigin(
            new URL('http://localhost:3000'),
            new URL('http://127.0.0.1:3000/api/tracking'),
        ),
        true,
    );
    assert.equal(
        isAllowedTrackingOrigin(
            new URL('http://localhost:3001'),
            new URL('http://127.0.0.1:3000/api/tracking'),
        ),
        false,
    );
});

test('accepts an apex event URL only with a validated apex Origin', () => {
    const apexEventUrl = new URL('https://gredice.com/biljke');

    assert.equal(
        isAllowedTrackingEventSourceUrl(apexEventUrl, canonicalRequest),
        false,
    );
    assert.equal(
        isAllowedTrackingEventSourceUrl(
            apexEventUrl,
            canonicalRequest,
            new URL('https://www.gredice.com'),
        ),
        false,
    );
    assert.equal(
        isAllowedTrackingEventSourceUrl(
            new URL('https://unrelated.example/biljke'),
            canonicalRequest,
            apexOrigin,
        ),
        false,
    );
    assert.equal(
        isAllowedTrackingEventSourceUrl(
            new URL('https://www.gredice.com/biljke'),
            canonicalRequest,
        ),
        true,
    );
});
