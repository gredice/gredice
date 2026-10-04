import assert from 'node:assert/strict';
import test from 'node:test';
import {
    customerDeliveryRequestSupportHref,
    customerDeliverySupportHref,
    customerHandoffAdvisory,
    customerHandoffVerificationLabel,
    customerPickupSupportHref,
} from './deliveryCustomerReceipt';
import type { CustomerDeliveryReceiptSummary } from './deliveryDashboardTypes';

const receipt: CustomerDeliveryReceiptSummary = {
    requestReference: 'request-customer-owned-4144',
    deliveredAt: '2026-07-16T10:30:00.000Z',
    verification: 'verified',
    harvest: {
        plantName: 'Rajčica & bosiljak',
        operationName: 'Berba',
        raisedBedName: 'Gredica 4',
        fieldName: 'Polje 2',
        tracePath: '/trag/customer-owned-trace-4144',
    },
};

test('customer handoff language keeps QR verification advisory', () => {
    assert.match(customerHandoffAdvisory, /dodatna evidencija/);
    assert.match(customerHandoffAdvisory, /ne utječe na status/);
    assert.equal(
        customerHandoffVerificationLabel('verified'),
        'QR etiketa provjerena je pri predaji.',
    );
    assert.equal(
        customerHandoffVerificationLabel('no-label'),
        'QR etiketa nije bila dostupna pri predaji.',
    );
    assert.equal(
        customerHandoffVerificationLabel('skipped'),
        'QR provjera nije provedena pri predaji.',
    );
    assert.equal(
        customerHandoffVerificationLabel('not-recorded'),
        'Nema zabilježene QR provjere pri predaji.',
    );
});

test('customer support actions carry only the owned request and harvest references', () => {
    const privateSentinels = [
        'PRIVATE DRIVER NOTE',
        'foreign-request-4144',
        'private-run-4144',
        'private-stop-4144',
        'manual-verification',
    ];

    for (const [kind, expectedLabel] of [
        ['missing', 'Nedostaje urod'],
        ['damaged', 'Oštećen urod'],
        ['support', 'Pitanje o dostavi'],
    ] as const) {
        const href = customerDeliverySupportHref({ kind, receipt });
        const url = new URL(href);
        const body = url.searchParams.get('body');
        const subject = url.searchParams.get('subject');

        assert.equal(url.protocol, 'mailto:');
        assert.equal(url.pathname, 'podrska@gredice.com');
        assert.match(subject ?? '', new RegExp(expectedLabel));
        assert.doesNotMatch(subject ?? '', /request-customer-owned-4144/);
        assert.match(body ?? '', new RegExp(`Vrsta prijave: ${expectedLabel}`));
        assert.match(body ?? '', /request-customer-owned-4144/);
        assert.match(body ?? '', /Rajčica & bosiljak/);
        assert.match(body ?? '', /customer-owned-trace-4144/);
        for (const sentinel of privateSentinels) {
            assert.equal(href.includes(sentinel), false);
            assert.equal((body ?? '').includes(sentinel), false);
        }
    }
});

test('customer support action handles a receipt without a public trace', () => {
    const href = customerDeliverySupportHref({
        kind: 'support',
        receipt: {
            ...receipt,
            harvest: { ...receipt.harvest, tracePath: null },
        },
    });

    assert.match(
        new URL(href).searchParams.get('body') ?? '',
        /Trag uroda nije dostupan/,
    );
});

test('active and recovery support actions identify the exact request without destination data', () => {
    const href = customerDeliveryRequestSupportHref({
        kind: 'support',
        delivery: {
            requestReference: 'active-customer-request-4137',
            harvest: receipt.harvest,
        },
    });
    const body = new URL(href).searchParams.get('body') ?? '';

    assert.match(body, /active-customer-request-4137/);
    assert.match(body, /Rajčica & bosiljak/);
    assert.doesNotMatch(body, /Ilica|Primatelj|PRIVATE DRIVER/);
});

test('pickup support action uses pickup-safe copy and its exact request reference', () => {
    const href = customerPickupSupportHref({
        requestId: 'pickup-customer-request-4137',
        harvest: receipt.harvest,
    });
    const url = new URL(href);
    const subject = url.searchParams.get('subject') ?? '';
    const body = url.searchParams.get('body') ?? '';

    assert.match(subject, /Pitanje o preuzimanju/);
    assert.doesNotMatch(subject, /dostava/i);
    assert.match(body, /Vrsta zahtjeva: Preuzimanje/);
    assert.match(body, /Referenca preuzimanja: pickup-customer-request-4137/);
    assert.doesNotMatch(body, /Vozač|PRIVATE DRIVER/);
});
