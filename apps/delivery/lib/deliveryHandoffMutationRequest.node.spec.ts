import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeliveryHandoffMutationRequest } from './deliveryHandoffMutationRequest';

const occurredAt = '2026-07-16T08:30:00.000Z';
const expectedRetryAttempt = 2;

test('parses an ordered batch and preserves malformed scan data for auditing', () => {
    const result = parseDeliveryHandoffMutationRequest({
        expectedRetryAttempt,
        mutations: [
            {
                kind: 'scan',
                clientOperationId: 'handoff-scan-1',
                occurredAt,
                tracePath: '  this-is-not-a-valid-trace  ',
            },
            {
                kind: 'mark-item',
                clientOperationId: 'handoff-item-1',
                occurredAt: '2026-07-16T10:30:00+02:00',
                stopId: 42,
                outcome: 'missing',
            },
            {
                kind: 'mark-item',
                clientOperationId: 'handoff-item-2',
                occurredAt,
                stopId: 43,
                outcome: 'skipped',
                reason: 'scanner-unavailable',
            },
        ],
    });

    assert.deepEqual(result, {
        expectedRetryAttempt,
        mutations: [
            {
                kind: 'scan',
                clientOperationId: 'handoff-scan-1',
                occurredAt: new Date(occurredAt),
                tracePath: 'this-is-not-a-valid-trace',
            },
            {
                kind: 'mark-item',
                clientOperationId: 'handoff-item-1',
                occurredAt: new Date('2026-07-16T10:30:00+02:00'),
                stopId: 42,
                outcome: 'missing',
            },
            {
                kind: 'mark-item',
                clientOperationId: 'handoff-item-2',
                occurredAt: new Date(occurredAt),
                stopId: 43,
                outcome: 'skipped',
                reason: 'scanner-unavailable',
            },
        ],
    });
});

test('accepts every manual outcome and skip reason', () => {
    const result = parseDeliveryHandoffMutationRequest({
        expectedRetryAttempt,
        mutations: [
            ...(['no-label', 'missing'] as const).map((outcome, index) => ({
                kind: 'mark-item',
                clientOperationId: `manual-outcome-${index}`,
                occurredAt,
                stopId: index + 1,
                outcome,
            })),
            ...(
                [
                    'scanner-unavailable',
                    'label-unreadable',
                    'manual-verification',
                    'other-operational',
                ] as const
            ).map((reason, index) => ({
                kind: 'mark-item',
                clientOperationId: `skipped-reason-${index}`,
                occurredAt,
                stopId: index + 10,
                outcome: 'skipped',
                reason,
            })),
        ],
    });

    assert.ok(result);
    assert.equal(result.expectedRetryAttempt, expectedRetryAttempt);
    assert.equal(result.mutations.length, 6);
});

test('rejects unknown root and mutation keys', () => {
    const scan = {
        kind: 'scan',
        clientOperationId: 'handoff-scan-1',
        occurredAt,
        tracePath: '/trag/example',
    };
    assert.equal(
        parseDeliveryHandoffMutationRequest({
            expectedRetryAttempt,
            mutations: [scan],
            runId: 'client-controlled',
        }),
        null,
    );
    assert.equal(
        parseDeliveryHandoffMutationRequest({
            expectedRetryAttempt,
            mutations: [{ ...scan, traceToken: 'unexpected' }],
        }),
        null,
    );
    assert.equal(
        parseDeliveryHandoffMutationRequest({
            expectedRetryAttempt,
            mutations: [
                {
                    kind: 'mark-item',
                    clientOperationId: 'handoff-item-1',
                    occurredAt,
                    stopId: 1,
                    outcome: 'missing',
                    reason: 'manual-verification',
                },
            ],
        }),
        null,
    );
});

test('requires a nonnegative safe retry attempt', () => {
    const mutation = {
        kind: 'scan',
        clientOperationId: 'handoff-scan-1',
        occurredAt,
        tracePath: '/trag/example',
    };
    assert.equal(
        parseDeliveryHandoffMutationRequest({ mutations: [mutation] }),
        null,
    );
    for (const invalidAttempt of [
        -1,
        0.5,
        Number.MAX_SAFE_INTEGER + 1,
        '0',
        null,
    ]) {
        assert.equal(
            parseDeliveryHandoffMutationRequest({
                expectedRetryAttempt: invalidAttempt,
                mutations: [mutation],
            }),
            null,
        );
    }
    for (const validAttempt of [0, Number.MAX_SAFE_INTEGER]) {
        assert.equal(
            parseDeliveryHandoffMutationRequest({
                expectedRetryAttempt: validAttempt,
                mutations: [mutation],
            })?.expectedRetryAttempt,
            validAttempt,
        );
    }
});

test('requires a valid operation ID and rejects duplicates', () => {
    const mutation = {
        kind: 'scan',
        clientOperationId: 'handoff-shared',
        occurredAt,
        tracePath: '/trag/example',
    };
    for (const clientOperationId of ['short', 'with spaces', 'x'.repeat(129)]) {
        assert.equal(
            parseDeliveryHandoffMutationRequest({
                expectedRetryAttempt,
                mutations: [{ ...mutation, clientOperationId }],
            }),
            null,
        );
    }
    assert.equal(
        parseDeliveryHandoffMutationRequest({
            expectedRetryAttempt,
            mutations: [mutation, { ...mutation, tracePath: '/trag/other' }],
        }),
        null,
    );
});

test('rejects invalid ISO timestamps rather than normalizing them', () => {
    const mutation = {
        kind: 'scan',
        clientOperationId: 'handoff-scan-1',
        tracePath: '/trag/example',
    };
    for (const invalidDate of [
        'not-a-date',
        '2026-07-16',
        '2026-02-30T08:30:00.000Z',
        '2026-07-16 08:30:00Z',
        '2026-07-16T24:00:00.000Z',
        '2026-07-16T08:30:00+24:00',
    ]) {
        assert.equal(
            parseDeliveryHandoffMutationRequest({
                expectedRetryAttempt,
                mutations: [{ ...mutation, occurredAt: invalidDate }],
            }),
            null,
        );
    }
});

test('bounds scan values while retaining their unnormalized content', () => {
    const mutation = {
        kind: 'scan',
        clientOperationId: 'handoff-scan-1',
        occurredAt,
    };
    for (const tracePath of [
        '',
        '   ',
        'x'.repeat(2_049),
        ` ${'x'.repeat(2_048)} `,
        42,
    ]) {
        assert.equal(
            parseDeliveryHandoffMutationRequest({
                expectedRetryAttempt,
                mutations: [{ ...mutation, tracePath }],
            }),
            null,
        );
    }
    assert.equal(
        parseDeliveryHandoffMutationRequest({
            expectedRetryAttempt,
            mutations: [{ ...mutation, tracePath: 'x'.repeat(2_048) }],
        })?.mutations[0]?.kind,
        'scan',
    );
});

test('requires positive item IDs and a reason only for skipped items', () => {
    const mutation = {
        kind: 'mark-item',
        clientOperationId: 'handoff-item-1',
        occurredAt,
        stopId: 1,
        outcome: 'skipped',
    };
    for (const invalid of [
        mutation,
        { ...mutation, reason: 'customer-unavailable' },
        { ...mutation, stopId: 0, reason: 'label-unreadable' },
        { ...mutation, stopId: 1.5, reason: 'label-unreadable' },
        { ...mutation, stopId: 1e300, reason: 'label-unreadable' },
        {
            ...mutation,
            stopId: 2_147_483_648,
            reason: 'label-unreadable',
        },
        { ...mutation, stopId: '1', reason: 'label-unreadable' },
        { ...mutation, outcome: 'verified', reason: 'label-unreadable' },
    ]) {
        assert.equal(
            parseDeliveryHandoffMutationRequest({
                expectedRetryAttempt,
                mutations: [invalid],
            }),
            null,
        );
    }
});

test('requires between one and one hundred mutations', () => {
    assert.equal(
        parseDeliveryHandoffMutationRequest({
            expectedRetryAttempt,
            mutations: [],
        }),
        null,
    );
    assert.ok(
        parseDeliveryHandoffMutationRequest({
            expectedRetryAttempt,
            mutations: Array.from({ length: 100 }, (_, index) => ({
                kind: 'scan',
                clientOperationId: `handoff-scan-${index}`,
                occurredAt,
                tracePath: `/trag/${index}`,
            })),
        }),
    );
    assert.equal(
        parseDeliveryHandoffMutationRequest({
            expectedRetryAttempt,
            mutations: Array.from({ length: 101 }, (_, index) => ({
                kind: 'scan',
                clientOperationId: `handoff-scan-${index}`,
                occurredAt,
                tracePath: `/trag/${index}`,
            })),
        }),
        null,
    );
});
