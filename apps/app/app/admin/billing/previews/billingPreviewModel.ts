export type BillingDocumentKind = 'invoice' | 'receipt';
export type BillingPreviewSource = 'sample' | 'invoice' | 'receipt';
export type BillingPreviewWidth = 'compact' | 'document' | 'wide';

export interface BillingPreviewField {
    label: string;
    value: string;
    mono?: boolean;
}

export interface BillingPreviewLineItem {
    description: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
    reference?: string;
}

export interface BillingDocumentPreviewModel {
    kind: BillingDocumentKind;
    documentLabel: string;
    title: string;
    number: string;
    statusLabel: string;
    statusTone: 'neutral' | 'warning' | 'info' | 'success' | 'error';
    issuedAt: string;
    dueAt?: string;
    paidAt?: string;
    seller: BillingPreviewField[];
    customer: BillingPreviewField[];
    payment: BillingPreviewField[];
    fiscalization: BillingPreviewField[];
    lineItems: BillingPreviewLineItem[];
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
    notes?: string;
    terms?: string;
}

export interface BillingInvoicePreviewRecord {
    invoiceNumber: string;
    status: string;
    subtotal: string | number;
    taxAmount: string | number;
    totalAmount: string | number;
    currency: string;
    issueDate: Date;
    dueDate: Date;
    paidDate?: Date | null;
    transactionId?: number | null;
    billToName?: string | null;
    billToEmail?: string | null;
    billToAddress?: string | null;
    billToCity?: string | null;
    billToState?: string | null;
    billToZip?: string | null;
    billToCountry?: string | null;
    notes?: string | null;
    terms?: string | null;
    invoiceItems?: BillingInvoiceItemPreviewRecord[] | null;
}

export interface BillingInvoiceItemPreviewRecord {
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    totalPrice: string | number;
    entityId?: string | null;
    entityTypeName?: string | null;
}

export interface BillingReceiptPreviewRecord {
    receiptNumber: string;
    yearReceiptNumber: string;
    subtotal: string | number;
    taxAmount: string | number;
    totalAmount: string | number;
    currency: string;
    paymentMethod: string;
    paymentReference?: string | null;
    jir?: string | null;
    zki?: string | null;
    cisStatus: string;
    cisReference?: string | null;
    cisErrorMessage?: string | null;
    cisTimestamp?: Date | null;
    issuedAt: Date;
    businessPin?: string | null;
    businessName?: string | null;
    businessAddress?: string | null;
    customerPin?: string | null;
    customerName?: string | null;
    customerAddress?: string | null;
    invoice?: BillingInvoicePreviewRecord | null;
}

export interface BillingPreviewSearchState {
    documentKind: BillingDocumentKind;
    source: BillingPreviewSource;
    width: BillingPreviewWidth;
    sampleId: string;
    invoiceId: string;
    receiptId: string;
}

const emptyValue = '-';

const invoiceStatusLabels: Record<string, string> = {
    cancelled: 'Otkazano',
    draft: 'Nacrt',
    paid: 'Plaćeno',
    pending: 'Na čekanju',
    sent: 'Poslano',
};

const receiptStatusLabels: Record<string, string> = {
    confirmed: 'Potvrđeno',
    failed: 'Neuspješno',
    pending: 'Na čekanju',
    sent: 'Poslano u CIS',
};

const paymentMethodLabels: Record<string, string> = {
    bank_transfer: 'Transakcijski račun',
    card: 'Kartica',
    cash: 'Gotovina',
};

function cleanText(value: string | null | undefined) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : undefined;
}

function formatDate(value: Date | string | null | undefined, time = false) {
    if (!value) {
        return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        ...(time ? { timeStyle: 'short' } : {}),
    }).format(date);
}

export function formatBillingMoney(
    value: string | number | null | undefined,
    currency: string | null | undefined,
) {
    const amount =
        typeof value === 'number' ? value : Number.parseFloat(value ?? '');
    const currencyCode = currency?.toUpperCase() || 'EUR';

    if (!Number.isFinite(amount)) {
        return emptyValue;
    }

    try {
        return new Intl.NumberFormat('hr-HR', {
            currency: currencyCode,
            style: 'currency',
        }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currencyCode}`;
    }
}

function field(
    label: string,
    value: string | null | undefined,
    mono = false,
): BillingPreviewField | null {
    const cleaned = cleanText(value);
    if (!cleaned) {
        return null;
    }

    return { label, value: cleaned, mono };
}

function isBillingPreviewField(
    value: BillingPreviewField | null,
): value is BillingPreviewField {
    return value !== null;
}

function compactAddress(parts: (string | null | undefined)[]) {
    return parts.map(cleanText).filter(Boolean).join(', ');
}

function invoiceStatusTone(status: string) {
    switch (status) {
        case 'paid':
            return 'success';
        case 'sent':
            return 'info';
        case 'pending':
            return 'warning';
        case 'cancelled':
            return 'neutral';
        default:
            return 'neutral';
    }
}

function receiptStatusTone(status: string) {
    switch (status) {
        case 'confirmed':
            return 'success';
        case 'failed':
            return 'error';
        case 'sent':
            return 'info';
        default:
            return 'warning';
    }
}

function buildLineItems(
    items: BillingInvoiceItemPreviewRecord[] | null | undefined,
    currency: string,
) {
    if (!items?.length) {
        return [
            {
                description: 'Narudžba',
                quantity: '1',
                unitPrice: emptyValue,
                totalPrice: emptyValue,
            },
        ];
    }

    return items.map((item) => ({
        description: cleanText(item.description) ?? 'Stavka',
        quantity: formatQuantity(item.quantity),
        unitPrice: formatBillingMoney(item.unitPrice, currency),
        totalPrice: formatBillingMoney(item.totalPrice, currency),
        reference:
            item.entityTypeName && item.entityId
                ? `${item.entityTypeName} #${item.entityId}`
                : undefined,
    }));
}

function buildReceiptLineItems(receipt: BillingReceiptPreviewRecord) {
    if (receipt.invoice?.invoiceItems?.length) {
        return buildLineItems(receipt.invoice.invoiceItems, receipt.currency);
    }

    return [
        {
            description: 'Fiskalni račun',
            quantity: '1',
            unitPrice: formatBillingMoney(receipt.subtotal, receipt.currency),
            totalPrice: formatBillingMoney(
                receipt.totalAmount,
                receipt.currency,
            ),
        },
    ];
}

function formatQuantity(value: string | number) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity)) {
        return emptyValue;
    }

    return quantity.toLocaleString('hr-HR', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
}

export function buildInvoicePreviewModel(
    invoice: BillingInvoicePreviewRecord,
): BillingDocumentPreviewModel {
    const billingAddress = compactAddress([
        invoice.billToAddress,
        invoice.billToZip,
        invoice.billToCity,
        invoice.billToState,
        invoice.billToCountry,
    ]);
    const seller = [
        field('Izdavatelj', 'Gredice'),
        field('Web', 'gredice.com'),
    ].filter(isBillingPreviewField);
    const customer = [
        field('Kupac', invoice.billToName),
        field('Email', invoice.billToEmail),
        field('Adresa', billingAddress),
    ].filter(isBillingPreviewField);
    const payment = [
        field(
            'Transakcija',
            invoice.transactionId ? `#${invoice.transactionId}` : undefined,
            true,
        ),
        field('Datum plaćanja', formatDate(invoice.paidDate)),
    ].filter(isBillingPreviewField);

    return {
        kind: 'invoice',
        documentLabel: 'Ponuda',
        title: `Ponuda ${invoice.invoiceNumber}`,
        number: invoice.invoiceNumber,
        statusLabel: invoiceStatusLabels[invoice.status] ?? invoice.status,
        statusTone: invoiceStatusTone(invoice.status),
        issuedAt: formatDate(invoice.issueDate) ?? emptyValue,
        dueAt: formatDate(invoice.dueDate),
        paidAt: formatDate(invoice.paidDate),
        seller,
        customer:
            customer.length > 0
                ? customer
                : [{ label: 'Kupac', value: 'Nije upisano' }],
        payment,
        fiscalization: [],
        lineItems: buildLineItems(invoice.invoiceItems, invoice.currency),
        subtotal: formatBillingMoney(invoice.subtotal, invoice.currency),
        taxAmount: formatBillingMoney(invoice.taxAmount, invoice.currency),
        totalAmount: formatBillingMoney(invoice.totalAmount, invoice.currency),
        notes: cleanText(invoice.notes),
        terms: cleanText(invoice.terms),
    };
}

export function buildReceiptPreviewModel(
    receipt: BillingReceiptPreviewRecord,
): BillingDocumentPreviewModel {
    const invoice = receipt.invoice;
    const seller = [
        field('Izdavatelj', receipt.businessName ?? 'Gredice'),
        field('OIB', receipt.businessPin, true),
        field('Adresa', receipt.businessAddress),
    ].filter(isBillingPreviewField);
    const customer = [
        field('Kupac', receipt.customerName ?? invoice?.billToName),
        field('OIB kupca', receipt.customerPin, true),
        field(
            'Adresa',
            receipt.customerAddress ??
                compactAddress([
                    invoice?.billToAddress,
                    invoice?.billToZip,
                    invoice?.billToCity,
                    invoice?.billToCountry,
                ]),
        ),
    ].filter(isBillingPreviewField);
    const payment = [
        field(
            'Način plaćanja',
            paymentMethodLabels[receipt.paymentMethod] ?? receipt.paymentMethod,
        ),
        field('Referenca', receipt.paymentReference, true),
        field(
            'Povezana ponuda',
            invoice?.invoiceNumber ??
                (invoice ? undefined : 'Nije povezano s ponudom'),
        ),
    ].filter(isBillingPreviewField);
    const fiscalization = [
        field('JIR', receipt.jir, true),
        field('ZKI', receipt.zki, true),
        field(
            'CIS status',
            receiptStatusLabels[receipt.cisStatus] ?? receipt.cisStatus,
        ),
        field('CIS vrijeme', formatDate(receipt.cisTimestamp, true)),
        field('CIS referenca', receipt.cisReference, true),
        field('CIS poruka', receipt.cisErrorMessage),
    ].filter(isBillingPreviewField);
    const number = receipt.yearReceiptNumber || receipt.receiptNumber;

    return {
        kind: 'receipt',
        documentLabel: 'Fiskalni račun',
        title: `Fiskalni račun ${number}`,
        number,
        statusLabel:
            receiptStatusLabels[receipt.cisStatus] ?? receipt.cisStatus,
        statusTone: receiptStatusTone(receipt.cisStatus),
        issuedAt: formatDate(receipt.issuedAt, true) ?? emptyValue,
        seller,
        customer:
            customer.length > 0
                ? customer
                : [{ label: 'Kupac', value: 'Nije upisano' }],
        payment,
        fiscalization,
        lineItems: buildReceiptLineItems(receipt),
        subtotal: formatBillingMoney(receipt.subtotal, receipt.currency),
        taxAmount: formatBillingMoney(receipt.taxAmount, receipt.currency),
        totalAmount: formatBillingMoney(receipt.totalAmount, receipt.currency),
        notes: cleanText(invoice?.notes),
        terms: cleanText(invoice?.terms),
    };
}

const sampleDate = new Date('2026-07-05T10:15:00Z');
const sampleDueDate = new Date('2026-07-20T10:15:00Z');

const normalInvoiceSample: BillingInvoicePreviewRecord = {
    invoiceNumber: 'PON-2026-00042',
    status: 'sent',
    subtotal: '79.98',
    taxAmount: '20.00',
    totalAmount: '99.98',
    currency: 'eur',
    issueDate: sampleDate,
    dueDate: sampleDueDate,
    transactionId: 1842,
    billToName: 'Ana Horvat',
    billToEmail: 'ana@example.com',
    billToAddress: 'Ulica vrtova 12',
    billToCity: 'Zagreb',
    billToZip: '10000',
    billToCountry: 'Hrvatska',
    notes: 'Plaćanje karticom kroz Gredice checkout.',
    terms: 'Ponuda vrijedi do datuma dospijeća.',
    invoiceItems: [
        {
            description: 'Paket radnji u vrtu - zalijevanje i prihrana',
            quantity: '1.00',
            unitPrice: '49.99',
            totalPrice: '49.99',
            entityId: '42',
            entityTypeName: 'operation',
        },
        {
            description: 'Dostava sezonske berbe',
            quantity: '1.00',
            unitPrice: '49.99',
            totalPrice: '49.99',
        },
    ],
};

const longLineInvoiceSample: BillingInvoicePreviewRecord = {
    ...normalInvoiceSample,
    invoiceNumber: 'PON-2026-00043',
    invoiceItems: [
        {
            description:
                'Vrlo dug opis stavke koji simulira kombiniranu narudzbu radnji, suncokreta, dostave i posebnih napomena kupca za dizajnerski pregled dokumenta na uskom zaslonu',
            quantity: '3.00',
            unitPrice: '33.33',
            totalPrice: '99.99',
        },
    ],
};

const missingCustomerInvoiceSample: BillingInvoicePreviewRecord = {
    ...normalInvoiceSample,
    invoiceNumber: 'PON-2026-00044',
    billToName: null,
    billToEmail: 'anonimni-kupac@example.com',
    billToAddress: null,
    billToCity: null,
    billToZip: null,
    billToCountry: null,
    notes: null,
    terms: null,
};

const fiscalizedReceiptSample: BillingReceiptPreviewRecord = {
    receiptNumber: '42',
    yearReceiptNumber: '2026-42',
    subtotal: '79.98',
    taxAmount: '20.00',
    totalAmount: '99.98',
    currency: 'eur',
    paymentMethod: 'card',
    paymentReference: 'cs_test_4035',
    jir: '3f8b3d2c-7f10-48bc-8e0b-4035fiscal',
    zki: '8d2c1a6f4e9b4035',
    cisStatus: 'confirmed',
    cisReference: 'CIS-2026-42',
    cisTimestamp: sampleDate,
    issuedAt: sampleDate,
    businessPin: '12345678901',
    businessName: 'Gredice d.o.o.',
    businessAddress: 'Ulica vrtova 1, 10000 Zagreb',
    customerName: 'Ana Horvat',
    customerAddress: 'Ulica vrtova 12, 10000 Zagreb',
    invoice: normalInvoiceSample,
};

const pendingReceiptSample: BillingReceiptPreviewRecord = {
    ...fiscalizedReceiptSample,
    receiptNumber: '43',
    yearReceiptNumber: '2026-43',
    jir: null,
    zki: null,
    cisStatus: 'pending',
    cisReference: null,
    cisTimestamp: null,
};

export const billingPreviewSampleOptions = [
    {
        documentKind: 'invoice',
        label: 'Ponuda - normalna narudžba',
        value: 'invoice-normal',
    },
    {
        documentKind: 'invoice',
        label: 'Ponuda - duga stavka',
        value: 'invoice-long-line',
    },
    {
        documentKind: 'invoice',
        label: 'Ponuda - manjkavi podaci kupca',
        value: 'invoice-missing-customer',
    },
    {
        documentKind: 'receipt',
        label: 'Fiskalni račun - fiskaliziran',
        value: 'receipt-fiscalized',
    },
    {
        documentKind: 'receipt',
        label: 'Fiskalni račun - na čekanju',
        value: 'receipt-pending',
    },
] satisfies {
    documentKind: BillingDocumentKind;
    label: string;
    value: string;
}[];

export function getBillingPreviewSample(
    documentKind: BillingDocumentKind,
    sampleId: string,
) {
    switch (sampleId) {
        case 'invoice-long-line':
            return buildInvoicePreviewModel(longLineInvoiceSample);
        case 'invoice-missing-customer':
            return buildInvoicePreviewModel(missingCustomerInvoiceSample);
        case 'receipt-fiscalized':
            return buildReceiptPreviewModel(fiscalizedReceiptSample);
        case 'receipt-pending':
            return buildReceiptPreviewModel(pendingReceiptSample);
        default:
            return documentKind === 'receipt'
                ? buildReceiptPreviewModel(fiscalizedReceiptSample)
                : buildInvoicePreviewModel(normalInvoiceSample);
    }
}

function firstQueryValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }

    return value ?? '';
}

export function parseBillingPreviewSearchParams(
    searchParams: Record<string, string | string[] | undefined>,
): BillingPreviewSearchState {
    const documentType = firstQueryValue(searchParams.documentType);
    const source = firstQueryValue(searchParams.source);
    const width = firstQueryValue(searchParams.width);
    const sampleId = firstQueryValue(searchParams.sampleId);

    return {
        documentKind: documentType === 'receipt' ? 'receipt' : 'invoice',
        source:
            source === 'invoice' || source === 'receipt' ? source : 'sample',
        width: width === 'compact' || width === 'wide' ? width : 'document',
        sampleId: sampleId || 'invoice-normal',
        invoiceId: firstQueryValue(searchParams.invoiceId),
        receiptId: firstQueryValue(searchParams.receiptId),
    };
}

export function parsePositiveInteger(value: string) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
