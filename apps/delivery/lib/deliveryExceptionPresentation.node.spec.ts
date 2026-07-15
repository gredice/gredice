import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    DeliveryExceptionOutcome,
    DeliveryExceptionReason,
    DeliveryStopDeliverySummary,
} from './deliveryDashboardTypes';
import {
    actionableDeliveryExceptionItems,
    buildDeliveryExceptionMutation,
    customerDeliveryRecoverySummary,
    type DeliveryExceptionMutation,
    deliveryDispatchContactHref,
    deliveryExceptionConfirmation,
    deliveryExceptionItemIdentityLabels,
    deliveryExceptionOutcomeIsTerminal,
    deliveryExceptionOutcomeLabel,
    deliveryExceptionReasonLabel,
    deliveryExceptionReasonOptions,
    driverDeliveryExceptionSummary,
} from './deliveryExceptionPresentation';

const allReasons: DeliveryExceptionReason[] = [
    'customer-unavailable',
    'address-inaccessible',
    'address-wrong',
    'harvest-damaged',
    'harvest-missing',
    'cancellation',
    'operational-other',
];

function delivery({
    requestId,
    stopId,
    stopState = 'pending',
}: {
    requestId: string;
    stopId: number | null;
    stopState?: string;
}): DeliveryStopDeliverySummary {
    return {
        stopId,
        stopState,
        requestId,
        requestState: 'in_delivery',
        contactName: `Kontakt ${requestId}`,
        phone: null,
        addressLabel: null,
        requestNotes: null,
        deliveryNotes: null,
        harvest: {
            plantName: `Biljka ${requestId}`,
            operationName: null,
            raisedBedName: null,
            fieldName: null,
            tracePath: null,
        },
        exception: null,
    };
}

function validMutation(overrides?: {
    deliveries?: DeliveryStopDeliverySummary[];
    selectedRequestIds?: string[];
    outcome?: Exclude<DeliveryExceptionOutcome, 'cancelled'>;
    reason?: DeliveryExceptionReason;
    note?: string;
}) {
    return buildDeliveryExceptionMutation({
        deliveries: overrides?.deliveries ?? [
            delivery({ requestId: 'request-one', stopId: 11 }),
        ],
        selectedRequestIds: overrides?.selectedRequestIds ?? ['request-one'],
        outcome: overrides?.outcome ?? 'deferred',
        reason: overrides?.reason ?? 'customer-unavailable',
        note: overrides?.note ?? '',
        expectedRouteRevision: 7,
        clientOperationId: ' operation-123 ',
        occurredAt: '2026-07-15T10:30:00+02:00',
    });
}

function mutationWithOutcome(
    outcome: DeliveryExceptionOutcome,
    count: number,
): DeliveryExceptionMutation {
    const reason: DeliveryExceptionReason =
        outcome === 'cancelled' ? 'cancellation' : 'customer-unavailable';
    return {
        expectedRouteRevision: 1,
        clientOperationId: 'confirmation-test',
        occurredAt: '2026-07-15T08:30:00.000Z',
        exceptions: Array.from({ length: count }, (_, index) => ({
            stopId: index + 1,
            outcome,
            reason,
        })),
    };
}

test('presents every supported exception reason exactly once', () => {
    assert.deepEqual(
        deliveryExceptionReasonOptions.map((option) => option.value),
        allReasons,
    );
    assert.equal(
        new Set(deliveryExceptionReasonOptions.map((option) => option.value))
            .size,
        allReasons.length,
    );
    for (const reason of allReasons) {
        assert.notEqual(deliveryExceptionReasonLabel(reason), reason);
    }
    for (const option of deliveryExceptionReasonOptions) {
        assert.notEqual(option.label.trim(), '');
        assert.notEqual(option.description.trim(), '');
    }
});

test('filters actionable children and builds a deterministic bulk subset', () => {
    const deliveries = [
        delivery({ requestId: 'third', stopId: 30 }),
        delivery({
            requestId: 'delivered',
            stopId: 10,
            stopState: 'delivered',
        }),
        delivery({ requestId: 'first', stopId: 12, stopState: 'arrived' }),
        delivery({ requestId: 'failed', stopId: 11, stopState: 'failed' }),
        delivery({ requestId: 'missing-stop', stopId: null }),
        delivery({ requestId: 'second', stopId: 20 }),
    ];

    assert.deepEqual(
        actionableDeliveryExceptionItems(deliveries).map(
            (item) => item.requestId,
        ),
        ['third', 'first', 'second'],
    );

    const result = validMutation({
        deliveries,
        selectedRequestIds: [
            'third',
            'delivered',
            'first',
            'failed',
            'missing-stop',
        ],
        outcome: 'failed',
        reason: 'address-inaccessible',
        note: '  Prilaz je privremeno zatvoren.  ',
    });

    assert.equal(result.status, 'valid');
    if (result.status !== 'valid') return;
    assert.deepEqual(result.mutation, {
        expectedRouteRevision: 7,
        clientOperationId: 'operation-123',
        occurredAt: '2026-07-15T08:30:00.000Z',
        exceptions: [
            {
                stopId: 12,
                outcome: 'failed',
                reason: 'address-inaccessible',
                note: 'Prilaz je privremeno zatvoren.',
            },
            {
                stopId: 30,
                outcome: 'failed',
                reason: 'address-inaccessible',
                note: 'Prilaz je privremeno zatvoren.',
            },
        ],
    });
});

test('makes colliding driver item identities unique with stable full-token fallback', () => {
    const first = delivery({ requestId: 'request-collision-one', stopId: 41 });
    const second = delivery({ requestId: 'request-collision-two', stopId: 42 });
    const duplicateHarvest = {
        plantName: 'Rajčica Roma',
        operationName: 'Berba',
        raisedBedName: 'Gredica Z',
        fieldName: null,
    };
    const identities = deliveryExceptionItemIdentityLabels([
        {
            ...first,
            contactName: 'Iva Ista',
            harvest: {
                ...duplicateHarvest,
                tracePath: '/trag/shared-prefix-one-0001',
            },
        },
        {
            ...second,
            contactName: 'Iva Ista',
            harvest: {
                ...duplicateHarvest,
                tracePath: '/trag/shared-prefix-two-0001',
            },
        },
    ]);

    assert.equal(
        identities.get(first.requestId),
        'Rajčica Roma · Gredica Z · Iva Ista · trag shared-prefix-one-0001',
    );
    assert.equal(
        identities.get(second.requestId),
        'Rajčica Roma · Gredica Z · Iva Ista · trag shared-prefix-two-0001',
    );
    assert.notEqual(
        identities.get(first.requestId),
        identities.get(second.requestId),
    );
});

test('preserves deferred and failed semantics and pairs cancellation with cancelled', () => {
    const deferred = validMutation({ outcome: 'deferred' });
    assert.equal(deferred.status, 'valid');
    if (deferred.status === 'valid') {
        assert.equal(deferred.mutation.exceptions[0]?.outcome, 'deferred');
    }

    const failed = validMutation({
        outcome: 'failed',
        reason: 'address-wrong',
    });
    assert.equal(failed.status, 'valid');
    if (failed.status === 'valid') {
        assert.equal(failed.mutation.exceptions[0]?.outcome, 'failed');
    }

    const cancelled = validMutation({
        outcome: 'deferred',
        reason: 'cancellation',
    });
    assert.equal(cancelled.status, 'valid');
    if (cancelled.status === 'valid') {
        assert.deepEqual(cancelled.mutation.exceptions[0], {
            stopId: 11,
            outcome: 'cancelled',
            reason: 'cancellation',
        });
    }
});

test('requires an operational-other note and rejects an empty actionable selection', () => {
    const missingNote = validMutation({
        reason: 'operational-other',
        note: '   ',
    });
    assert.deepEqual(missingNote, {
        status: 'invalid',
        message: 'Ukratko opiši operativni problem.',
    });

    const describedOther = validMutation({
        reason: 'operational-other',
        note: '  Parkirna rampa se ne otvara. ',
    });
    assert.equal(describedOther.status, 'valid');
    if (describedOther.status === 'valid') {
        assert.equal(
            describedOther.mutation.exceptions[0]?.note,
            'Parkirna rampa se ne otvara.',
        );
    }

    const noSelection = validMutation({ selectedRequestIds: [] });
    assert.deepEqual(noSelection, {
        status: 'invalid',
        message: 'Odaberi barem jedan urod na koji se problem odnosi.',
    });

    const onlyTerminalChildren = validMutation({
        deliveries: [
            delivery({
                requestId: 'already-failed',
                stopId: 8,
                stopState: 'failed',
            }),
        ],
        selectedRequestIds: ['already-failed'],
    });
    assert.equal(onlyTerminalChildren.status, 'invalid');
});

test('provides distinct confirmation copy and outcome metadata', () => {
    const expectations: Array<{
        outcome: DeliveryExceptionOutcome;
        singular: string;
        plural: string;
        label: string;
        terminal: boolean;
    }> = [
        {
            outcome: 'deferred',
            singular: 'Ponovni pokušaj je dodan na kraj rute za odabrani urod.',
            plural: 'Ponovni pokušaj je dodan na kraj rute za 2 odabrana uroda.',
            label: 'Ponovni pokušaj',
            terminal: false,
        },
        {
            outcome: 'failed',
            singular:
                'Neuspjela dostava je zabilježena za odabrani urod. Ruta se može nastaviti.',
            plural: 'Neuspjela dostava je zabilježena za 2 odabrana uroda. Ruta se može nastaviti.',
            label: 'Neuspjela dostava',
            terminal: true,
        },
        {
            outcome: 'cancelled',
            singular:
                'Otkazivanje je zabilježeno za odabrani urod. Ruta se može nastaviti.',
            plural: 'Otkazivanje je zabilježeno za 2 odabrana uroda. Ruta se može nastaviti.',
            label: 'Otkazano',
            terminal: true,
        },
    ];

    for (const expectation of expectations) {
        assert.equal(
            deliveryExceptionConfirmation(
                mutationWithOutcome(expectation.outcome, 1),
            ),
            expectation.singular,
        );
        assert.equal(
            deliveryExceptionConfirmation(
                mutationWithOutcome(expectation.outcome, 2),
            ),
            expectation.plural,
        );
        assert.equal(
            deliveryExceptionOutcomeLabel(expectation.outcome),
            expectation.label,
        );
        assert.equal(
            deliveryExceptionOutcomeIsTerminal(expectation.outcome),
            expectation.terminal,
        );
    }
});

test('projects a bounded driver exception summary and rejects unknown values', () => {
    const summary = driverDeliveryExceptionSummary({
        state: 'failed',
        reason: 'address-wrong',
        note: '  Nazovi dispečera prije nastavka.  ',
        occurredAt: new Date('2026-07-15T08:30:00.000Z'),
    });

    assert.deepEqual(summary, {
        outcome: 'failed',
        reason: 'address-wrong',
        note: 'Nazovi dispečera prije nastavka.',
        occurredAt: '2026-07-15T08:30:00.000Z',
    });
    assert.deepEqual(Object.keys(summary ?? {}).sort(), [
        'note',
        'occurredAt',
        'outcome',
        'reason',
    ]);
    assert.equal(
        driverDeliveryExceptionSummary({
            state: 'failed',
            reason: 'private-legacy-reason',
            note: 'private note',
            occurredAt: new Date('2026-07-15T08:30:00.000Z'),
        }),
        null,
    );
    assert.equal(
        driverDeliveryExceptionSummary({
            state: 'pending',
            reason: 'address-wrong',
            note: null,
            occurredAt: new Date('2026-07-15T08:30:00.000Z'),
        }),
        null,
    );
});

test('projects retry, cancellation, and a configured 72-hour HQ pickup window', () => {
    const configuredHqAddress = 'Konfigurirani HQ, Testna 42, Zagreb';
    const exceptionRecordedAt = new Date('2026-07-15T08:30:00.000Z');
    const now = new Date('2026-07-15T09:00:00.000Z');

    assert.deepEqual(
        customerDeliveryRecoverySummary({
            requestState: 'in_delivery',
            stopState: 'deferred',
            exceptionReason: 'customer-unavailable',
            hqAddress: configuredHqAddress,
        }),
        { kind: 'retry-planned' },
    );
    assert.deepEqual(
        customerDeliveryRecoverySummary({
            requestState: 'in_delivery',
            stopState: 'cancelled',
            exceptionReason: 'cancellation',
            hqAddress: configuredHqAddress,
        }),
        { kind: 'cancelled' },
    );
    assert.deepEqual(
        customerDeliveryRecoverySummary({
            requestState: 'in_delivery',
            stopState: 'failed',
            exceptionReason: 'customer-unavailable',
            exceptionRecordedAt,
            hqAddress: configuredHqAddress,
            now,
        }),
        {
            kind: 'hq-pickup',
            pickupAddress: configuredHqAddress,
            pickupDeadlineAt: '2026-07-18T08:30:00.000Z',
            pickupWindowHours: 72,
        },
    );
    assert.deepEqual(
        customerDeliveryRecoverySummary({
            requestState: 'failed',
            stopState: null,
            exceptionReason: 'address-wrong',
            exceptionRecordedAt,
            hqAddress: configuredHqAddress,
            now,
        }),
        {
            kind: 'hq-pickup',
            pickupAddress: configuredHqAddress,
            pickupDeadlineAt: '2026-07-18T08:30:00.000Z',
            pickupWindowHours: 72,
        },
    );

    const customerRecovery = customerDeliveryRecoverySummary({
        requestState: 'failed',
        stopState: 'failed',
        exceptionReason: 'customer-unavailable',
        exceptionRecordedAt,
        hqAddress: configuredHqAddress,
        now,
    });
    const serializedRecovery = JSON.stringify(customerRecovery);
    for (const privateValue of [
        'customer-unavailable',
        'INTERNAL DRIVER NOTE',
        'account-owner@example.com',
    ]) {
        assert.equal(serializedRecovery.includes(privateValue), false);
    }
});

test('expires HQ pickup after 72 hours and falls back safely without a reliable occurrence time', () => {
    const input = {
        requestState: 'failed',
        stopState: 'failed',
        exceptionReason: 'customer-unavailable',
        hqAddress: 'Konfigurirani HQ, Testna 42, Zagreb',
    };

    assert.deepEqual(
        customerDeliveryRecoverySummary({
            ...input,
            exceptionRecordedAt: new Date('2026-07-15T08:30:00.000Z'),
            now: new Date('2026-07-18T08:30:00.000Z'),
        }),
        { kind: 'hq-pickup-expired' },
    );
    assert.deepEqual(
        customerDeliveryRecoverySummary({
            ...input,
            exceptionRecordedAt: null,
            now: new Date('2026-07-15T09:00:00.000Z'),
        }),
        { kind: 'support' },
    );
});

test('keeps damaged, missing, other, and unknown failed recovery support-only', () => {
    const configuredHqAddress = 'PRIVATE HQ ADDRESS MUST NOT LEAK';
    for (const exceptionReason of [
        'harvest-damaged',
        'harvest-missing',
        'operational-other',
        'unknown-private-reason',
    ]) {
        const recovery = customerDeliveryRecoverySummary({
            requestState: 'failed',
            stopState: 'failed',
            exceptionReason,
            hqAddress: configuredHqAddress,
        });
        assert.deepEqual(recovery, { kind: 'support' });
        assert.doesNotMatch(
            JSON.stringify(recovery),
            /PRIVATE|harvest|unknown-private-reason/,
        );
    }

    assert.equal(
        customerDeliveryRecoverySummary({
            requestState: 'in_delivery',
            stopState: 'pending',
            exceptionReason: null,
            hqAddress: configuredHqAddress,
        }),
        null,
    );
});

test('creates a dispatch href with operational identifiers and no customer PII', () => {
    const href = deliveryDispatchContactHref({
        runId: 'run-safe-123',
        stopId: 45,
    });
    const decodedHref = decodeURIComponent(href);

    assert.equal(
        decodedHref,
        'mailto:kontakt@gredice.com?subject=Pomoć dispečera · ruta run-safe-123 · stanica 45',
    );
    for (const privateValue of [
        'customer@example.com',
        '+385991234567',
        'Privatna 1, Zagreb',
        'Ime Kupca',
    ]) {
        assert.equal(decodedHref.includes(privateValue), false);
    }
});
