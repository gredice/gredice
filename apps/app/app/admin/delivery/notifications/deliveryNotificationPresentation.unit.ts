import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    DeliveryLifecycleNotificationDiagnostic,
    DeliveryLifecycleNotificationHealth,
} from '@gredice/storage';
import {
    deliveryNotificationProviderLabel,
    deliveryNotificationReasonLabel,
    groupDeliveryNotificationTimeline,
    parseDeliveryNotificationFilters,
    summarizeDeliveryNotificationHealth,
} from './deliveryNotificationPresentation';

function diagnostic(
    values: Partial<DeliveryLifecycleNotificationDiagnostic>,
): DeliveryLifecycleNotificationDiagnostic {
    return {
        attemptId: 1,
        channel: 'push',
        kind: 'attempt',
        milestone: 'near-arrival',
        notificationId: 'notification-1',
        occurredAt: new Date('2026-07-16T10:00:00.000Z'),
        outcome: 'sent',
        provider: 'push',
        reasonCode: 'sent',
        recordId: '1:00000000000000000001',
        requestId: 'request-1',
        sourceId: 'source-1',
        ...values,
    };
}

test('parses exact bounded identifiers and allowlisted channel filters', () => {
    const result = parseDeliveryNotificationFilters({
        channel: 'push',
        milestone: 'near-arrival',
        outcome: 'retrying',
        requestId: `request:${'a'.repeat(120)}`,
        sourceId: 'delivery.run_42~stop-3',
    });

    assert.equal(result.hasInvalidFilter, false);
    assert.deepEqual(result.filters, {
        channel: 'push',
        milestone: 'near-arrival',
        outcome: 'retrying',
        requestId: `request:${'a'.repeat(120)}`,
        sourceId: 'delivery.run_42~stop-3',
    });
});

test('rejects ambiguous, oversized, or potentially private filter values without echoing them', () => {
    const result = parseDeliveryNotificationFilters({
        channel: ['push', 'email'],
        milestone: 'private-address',
        outcome: 'provider-specific-result',
        requestId: 'customer@example.com',
        sourceId: '45.8150,15.9819'.repeat(10),
    });

    assert.equal(result.hasInvalidFilter, true);
    assert.deepEqual(result.filters, {
        channel: undefined,
        milestone: undefined,
        outcome: undefined,
        requestId: undefined,
        sourceId: undefined,
    });
    assert.deepEqual(result.values, {
        channel: '',
        milestone: '',
        outcome: '',
        requestId: '',
        sourceId: '',
    });
});

test('groups the timeline by request, source, and channel including pre-channel decisions', () => {
    const routeDecision = diagnostic({
        attemptId: null,
        channel: null,
        kind: 'decision',
        notificationId: null,
        outcome: 'suppressed',
        provider: 'unknown',
        reasonCode: 'eta_threshold_already_emitted',
        recordId: '2:00000000000000000004',
    });
    const pushSent = diagnostic({ recordId: '1:00000000000000000003' });
    const emailFailed = diagnostic({
        channel: 'email',
        outcome: 'failed',
        provider: 'email',
        reasonCode: 'sender_failed',
        recordId: '1:00000000000000000002',
    });
    const otherRequest = diagnostic({
        recordId: '1:00000000000000000001',
        requestId: 'request-2',
        sourceId: null,
    });

    const groups = groupDeliveryNotificationTimeline([
        routeDecision,
        pushSent,
        emailFailed,
        otherRequest,
    ]);

    assert.deepEqual(
        groups.map((request) => ({
            requestId: request.requestId,
            sources: request.sources.map((source) => ({
                channels: source.channels.map((channel) => ({
                    channel: channel.channel,
                    recordIds: channel.items.map((item) => item.recordId),
                })),
                sourceId: source.sourceId,
            })),
        })),
        [
            {
                requestId: 'request-1',
                sources: [
                    {
                        channels: [
                            {
                                channel: null,
                                recordIds: ['2:00000000000000000004'],
                            },
                            {
                                channel: 'push',
                                recordIds: ['1:00000000000000000003'],
                            },
                            {
                                channel: 'email',
                                recordIds: ['1:00000000000000000002'],
                            },
                        ],
                        sourceId: 'source-1',
                    },
                ],
            },
            {
                requestId: 'request-2',
                sources: [
                    {
                        channels: [
                            {
                                channel: 'push',
                                recordIds: ['1:00000000000000000001'],
                            },
                        ],
                        sourceId: null,
                    },
                ],
            },
        ],
    );
});

test('summarizes aggregate health without exposing diagnostic records', () => {
    const health: DeliveryLifecycleNotificationHealth = {
        alerts: {
            ambiguousEmailSending: false,
            retryExhausted: false,
            staleEligibleQueue: false,
            systemicFailure: true,
        },
        ambiguousEmailSendingCount: 0,
        channels: [
            {
                channel: 'push',
                failureCount: 3,
                failureRate: 0.3,
                severity: 'warning',
                terminalCount: 10,
            },
            {
                channel: 'email',
                failureCount: 1,
                failureRate: 0.1,
                severity: 'healthy',
                terminalCount: 10,
            },
        ],
        from: new Date('2026-07-16T09:45:00.000Z'),
        retryExhaustedCount: 0,
        severity: 'warning',
        staleEligibleQueueCount: 0,
        to: new Date('2026-07-16T10:00:00.000Z'),
    };

    assert.deepEqual(summarizeDeliveryNotificationHealth(health), {
        failureCount: 4,
        failureRate: 0.2,
        terminalCount: 20,
    });
});

test('uses fixed safe labels for normalized unknown values and decisions', () => {
    assert.equal(
        deliveryNotificationReasonLabel('eta_threshold_already_emitted'),
        'ETA prag je već obrađen',
    );
    assert.equal(
        deliveryNotificationReasonLabel('idempotency_reused'),
        'Ponovljeni zahtjev nije ponovno poslan',
    );
    assert.equal(
        deliveryNotificationReasonLabel('unknown'),
        'Razlog nije zabilježen',
    );
    assert.equal(
        deliveryNotificationProviderLabel('unknown'),
        'Nepoznati pružatelj',
    );
});
