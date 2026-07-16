import type {
    CustomerDeliveryReceiptSummary,
    CustomerHandoffVerification,
} from './deliveryDashboardTypes';

export type CustomerDeliverySupportKind = 'missing' | 'damaged' | 'support';

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

export function customerDeliverySupportHref({
    kind,
    receipt,
}: {
    kind: CustomerDeliverySupportKind;
    receipt: CustomerDeliveryReceiptSummary;
}) {
    const label = supportLabels[kind];
    const query = new URLSearchParams({
        subject: `${label} · dostava ${safeSubjectReference(receipt.requestReference)}`,
        body: [
            'Pozdrav,',
            '',
            `Vrsta prijave: ${label}`,
            `Referenca dostave: ${receipt.requestReference}`,
            `Urod: ${receipt.harvest.plantName}`,
            `Trag uroda: ${customerTraceReference(receipt.harvest.tracePath)}`,
            '',
            'Opis:',
        ].join('\n'),
    });

    return `mailto:podrska@gredice.com?${query.toString()}`;
}
