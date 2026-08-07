import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isCanonicalIsoTimestamp,
    isCustomerDeliveryEtaSummary,
    isCustomerDeliveryTrackingSummary,
} from './customerDeliveryValidation';

test('accepts only canonical ISO timestamps for customer dashboard data', () => {
    assert.equal(isCanonicalIsoTimestamp('2026-07-16T09:59:00.000Z'), true);
    for (const value of [
        1,
        '1',
        '2026-07-16',
        '2026-07-16T09:59:00Z',
        '2026-02-30T09:59:00.000Z',
        'not-a-date',
    ]) {
        assert.equal(isCanonicalIsoTimestamp(value), false);
    }
});

const validTrafficEta = {
    source: 'traffic-route',
    calculatedAt: '2026-07-16T09:59:00.000Z',
    freshness: 'fresh',
    confidence: 'high',
    rangeStartAt: '2026-07-16T10:25:00.000Z',
    rangeEndAt: '2026-07-16T10:40:00.000Z',
    remainingMinSeconds: 1_500,
    remainingMaxSeconds: 2_400,
};

test('accepts constructible customer ETA payload states', () => {
    assert.equal(isCustomerDeliveryEtaSummary(validTrafficEta), true);
    assert.equal(
        isCustomerDeliveryEtaSummary({
            ...validTrafficEta,
            source: 'route-plan',
            confidence: 'approximate',
        }),
        true,
    );
    assert.equal(
        isCustomerDeliveryEtaSummary({
            ...validTrafficEta,
            source: 'promised-window',
            calculatedAt: null,
            freshness: 'fallback',
            confidence: 'approximate',
        }),
        true,
    );
    assert.equal(
        isCustomerDeliveryEtaSummary({
            ...validTrafficEta,
            source: 'promised-window',
            calculatedAt: null,
            freshness: 'unavailable',
            confidence: 'none',
            rangeStartAt: null,
            rangeEndAt: null,
            remainingMinSeconds: null,
            remainingMaxSeconds: null,
        }),
        true,
    );
});

test('rejects malformed or internally inconsistent ETA payloads before rendering', () => {
    const invalidPayloads = [
        { ...validTrafficEta, rangeStartAt: 'not-a-date' },
        {
            ...validTrafficEta,
            rangeStartAt: validTrafficEta.rangeEndAt,
            rangeEndAt: validTrafficEta.rangeStartAt,
        },
        {
            ...validTrafficEta,
            rangeEndAt: validTrafficEta.rangeStartAt,
        },
        { ...validTrafficEta, remainingMinSeconds: Number.NaN },
        { ...validTrafficEta, remainingMaxSeconds: Number.POSITIVE_INFINITY },
        { ...validTrafficEta, remainingMinSeconds: -1 },
        {
            ...validTrafficEta,
            remainingMinSeconds: 2_500,
            remainingMaxSeconds: 2_400,
        },
        { ...validTrafficEta, rangeEndAt: null },
        { ...validTrafficEta, confidence: 'approximate' },
        {
            ...validTrafficEta,
            source: 'promised-window',
            freshness: 'fresh',
        },
        {
            ...validTrafficEta,
            source: 'promised-window',
            freshness: 'unavailable',
            confidence: 'none',
        },
    ];
    for (const payload of invalidPayloads) {
        assert.equal(isCustomerDeliveryEtaSummary(payload), false);
    }
});

test('accepts only canonical and bounded customer tracking payloads', () => {
    const liveTracking = {
        status: 'live',
        lastAcceptedAt: '2026-07-16T09:59:00.000Z',
        mapAvailable: true,
        exactLocationExpiresInMs: 60_000,
    };
    assert.equal(isCustomerDeliveryTrackingSummary(liveTracking), true);
    assert.equal(
        isCustomerDeliveryTrackingSummary({
            ...liveTracking,
            status: 'offline',
            mapAvailable: false,
            exactLocationExpiresInMs: null,
        }),
        true,
    );
    assert.equal(
        isCustomerDeliveryTrackingSummary({
            status: 'unavailable',
            lastAcceptedAt: null,
            mapAvailable: false,
            exactLocationExpiresInMs: null,
        }),
        true,
    );
    assert.equal(isCustomerDeliveryTrackingSummary(null), true);

    for (const payload of [
        { ...liveTracking, lastAcceptedAt: 'not-a-date' },
        { ...liveTracking, lastAcceptedAt: '2026-07-16T09:59:00Z' },
        { ...liveTracking, exactLocationExpiresInMs: Number.NaN },
        { ...liveTracking, exactLocationExpiresInMs: -1 },
        { ...liveTracking, exactLocationExpiresInMs: 120_001 },
        { ...liveTracking, exactLocationExpiresInMs: null },
        { ...liveTracking, status: 'offline' },
        {
            ...liveTracking,
            lastAcceptedAt: null,
            mapAvailable: false,
            exactLocationExpiresInMs: null,
        },
        {
            ...liveTracking,
            status: 'delayed',
            lastAcceptedAt: null,
            mapAvailable: false,
            exactLocationExpiresInMs: null,
        },
        {
            ...liveTracking,
            status: 'offline',
            lastAcceptedAt: null,
            mapAvailable: false,
            exactLocationExpiresInMs: null,
        },
        {
            ...liveTracking,
            status: 'unavailable',
            lastAcceptedAt: '2026-07-16T09:59:00.000Z',
            mapAvailable: false,
            exactLocationExpiresInMs: null,
        },
    ]) {
        assert.equal(isCustomerDeliveryTrackingSummary(payload), false);
    }
});
