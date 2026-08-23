import type {
    CustomerDeliveryReceiptSummary,
    CustomerHandoffVerification,
    CustomerPickupRequestSummary,
} from './deliveryDashboardTypes';

export type CustomerDeliverySupportKind = 'missing' | 'damaged' | 'support';

export type CustomerDeliverySupportReference = Pick<
    CustomerDeliveryReceiptSummary,
    'requestReference' | 'harvest'
>;

export const customerHandoffAdvisory =
    'QR skeniranje služi samo kao dodatna evidencija i ne utječe na status dovršene dostave.';

const verificationLabels: Record<CustomerHandoffVerification, string> = {
    verified: 'QR etiketa provjerena je pri predaji.',
    'no-label': 'QR etiketa nije bila dostupna pri predaji.',
    skipped: 'QR provjera nije provedena pri predaji.',
    'not-recorded': 'Nema zabilježene QR provjere pri predaji.',
};

const supportLabels: Record<CustomerDeliverySupportKind, string> = {
    missing: 'Nedostaje urod',
    damaged: 'Oštećen urod',
    support: 'Pitanje o dostavi',
};

export function customerHandoffVerificationLabel(
    verification: CustomerHandoffVerification,
) {
    return verificationLabels[verification];
}

function safeSubjectReference(reference: string) {
    const suffix = reference.replace(/[^a-zA-Z0-9-]/g, '').slice(-8);
    return suffix || 'dostava';
}

function customerTraceReference(
    tracePath: CustomerDeliveryReceiptSummary['harvest']['tracePath'],
) {
    return tracePath?.startsWith('/trag/')
        ? `https://www.gredice.com${tracePath}`
        : 'Trag uroda nije dostupan';
}

function customerRequestSupportHref({
    kind,
    mode,
    requestReference,
    harvest,
}: {
    kind: CustomerDeliverySupportKind;
    mode: 'delivery' | 'pickup';
    requestReference: string;
    harvest: CustomerDeliverySupportReference['harvest'];
}) {
    const label =
        mode === 'pickup' && kind === 'support'
            ? 'Pitanje o preuzimanju'
            : supportLabels[kind];
    const modeLabel = mode === 'delivery' ? 'Dostava' : 'Preuzimanje';
    const subjectMode = mode === 'delivery' ? 'dostava' : 'preuzimanje';
    const referenceLabel =
        mode === 'delivery' ? 'Referenca dostave' : 'Referenca preuzimanja';
    const query = new URLSearchParams({
        subject: `${label} · ${subjectMode} ${safeSubjectReference(requestReference)}`,
        body: [
            'Pozdrav,',
            '',
            `Vrsta zahtjeva: ${modeLabel}`,
            `Vrsta prijave: ${label}`,
            `${referenceLabel}: ${requestReference}`,
            `Urod: ${harvest.plantName}`,
            `Trag uroda: ${customerTraceReference(harvest.tracePath)}`,
            '',
            'Opis:',
        ].join('\n'),
    });

    return `mailto:podrska@gredice.com?${query.toString()}`;
}

export function customerDeliveryRequestSupportHref({
    kind,
    delivery,
}: {
    kind: CustomerDeliverySupportKind;
    delivery: CustomerDeliverySupportReference;
}) {
    return customerRequestSupportHref({
        kind,
        mode: 'delivery',
        requestReference: delivery.requestReference,
        harvest: delivery.harvest,
    });
}

export function customerPickupSupportHref(
    pickup: Pick<CustomerPickupRequestSummary, 'requestId' | 'harvest'>,
) {
    return customerRequestSupportHref({
        kind: 'support',
        mode: 'pickup',
        requestReference: pickup.requestId,
        harvest: pickup.harvest,
    });
}

export function customerDeliverySupportHref({
    kind,
    receipt,
}: {
    kind: CustomerDeliverySupportKind;
    receipt: CustomerDeliveryReceiptSummary;
}) {
    return customerDeliveryRequestSupportHref({
        kind,
        delivery: receipt,
    });
}
