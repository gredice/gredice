import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeliveryPickupMutationRequest } from './deliveryPickupMutationRequest';

const now = new Date('2026-07-15T08:00:00.000Z');
const occurredAt = '2026-07-15T07:59:00.000Z';
const traceToken = 'pickup-manifest-trace-token-2026';

test('parses and normalizes an ordered pickup mutation batch', () => {
    const result = parseDeliveryPickupMutationRequest(
        {
            mutations: [
                {
                    clientOperationId: 'operation-scan-1',
                    occurredAt,
                    kind: 'scan',
                    traceToken: `https://www.gredice.com/trag/${traceToken}?camera=1`,
                },
                {
                    clientOperationId: 'operation-item-1',
                    occurredAt,
                    kind: 'mark-item',
                    stopId: 42,
                    outcome: 'missing-label',
                },
                {
                    clientOperationId: 'operation-confirm-1',
                    occurredAt,
                    kind: 'confirm-manifest',
                    manifestId: 'manifest-1',
                },
            ],
        },
        now,
    );

    assert.ok(result);
    assert.equal(result.length, 3);
    assert.deepEqual(result[0], {
        clientOperationId: 'operation-scan-1',
        occurredAt: new Date(occurredAt),
        kind: 'scan',
        traceToken: `/trag/${traceToken}`,
    });
});

test('rejects duplicate operation IDs, invalid outcomes, and malformed scans', () => {
    const common = {
        clientOperationId: 'operation-shared',
        occurredAt,
    };
    assert.equal(
        parseDeliveryPickupMutationRequest(
            {
                mutations: [
                    { ...common, kind: 'scan', traceToken },
                    {
                        ...common,
                        kind: 'confirm-manifest',
                        manifestId: 'manifest-1',
                    },
                ],
            },
            now,
        ),
        null,
    );
    assert.equal(
        parseDeliveryPickupMutationRequest(
            {
                mutations: [
                    {
                        ...common,
                        kind: 'mark-item',
                        stopId: 1,
                        outcome: 'collected',
                    },
                ],
            },
            now,
        ),
        null,
    );
    assert.equal(
        parseDeliveryPickupMutationRequest(
            {
                mutations: [{ ...common, kind: 'scan', traceToken: 'invalid' }],
            },
            now,
        ),
        null,
    );
});

test('rejects empty and oversized batches', () => {
    assert.equal(
        parseDeliveryPickupMutationRequest({ mutations: [] }, now),
        null,
    );
    assert.equal(
        parseDeliveryPickupMutationRequest(
            {
                mutations: Array.from({ length: 101 }, (_, index) => ({
                    clientOperationId: `operation-${index}`,
                    occurredAt,
                    kind: 'confirm-manifest',
                    manifestId: `manifest-${index}`,
                })),
            },
            now,
        ),
        null,
    );
});

test('accepts replay timestamps regardless of age or clock skew but rejects invalid dates', () => {
    const result = parseDeliveryPickupMutationRequest(
        {
            mutations: [
                {
                    clientOperationId: 'operation-stale',
                    occurredAt: '2026-07-01T08:00:00.000Z',
                    kind: 'confirm-manifest',
                    manifestId: 'manifest-1',
                },
                {
                    clientOperationId: 'operation-future',
                    occurredAt: '2026-07-15T09:00:00.000Z',
                    kind: 'confirm-manifest',
                    manifestId: 'manifest-2',
                },
            ],
        },
        now,
    );
    assert.ok(result);
    assert.deepEqual(
        result.map((mutation) => mutation.occurredAt.toISOString()),
        ['2026-07-01T08:00:00.000Z', '2026-07-15T09:00:00.000Z'],
    );
    assert.equal(
        parseDeliveryPickupMutationRequest({
            mutations: [
                {
                    clientOperationId: 'operation-invalid-date',
                    occurredAt: 'not-a-date',
                    kind: 'confirm-manifest',
                    manifestId: 'manifest-1',
                },
            ],
        }),
        null,
    );
});
