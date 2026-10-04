import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildInvoicePreviewModel,
    buildReceiptPreviewModel,
    formatBillingMoney,
    getBillingPreviewSample,
    parseBillingPreviewSearchParams,
} from './billingPreviewModel';

test('formats money with Croatian currency conventions', () => {
    assert.equal(formatBillingMoney('1234.5', 'eur'), '1.234,50\u00a0€');
    assert.equal(formatBillingMoney('not-a-number', 'eur'), '-');
});

test('builds invoice preview model without raw null or undefined values', () => {
    const model = buildInvoicePreviewModel({
        invoiceNumber: 'PON-TEST',
        status: 'sent',
        subtotal: '10.00',
        taxAmount: '2.50',
        totalAmount: '12.50',
        currency: 'eur',
        issueDate: new Date('2026-07-05T00:00:00Z'),
        dueDate: new Date('2026-07-10T00:00:00Z'),
        billToEmail: 'kupac@example.com',
        billToName: null,
        billToAddress: null,
        billToCity: null,
        billToZip: null,
        billToCountry: null,
        invoiceItems: [
            {
                description:
                    'Duga stavka koja mora ostati citljiva u pregledu dokumenta',
                quantity: '2.00',
                unitPrice: '5.00',
                totalPrice: '10.00',
            },
        ],
    });
    const serialized = JSON.stringify(model);

    assert.equal(model.documentLabel, 'Ponuda');
    assert.equal(model.lineItems[0]?.quantity, '2');
    assert.equal(model.totalAmount, '12,50\u00a0€');
    assert.doesNotMatch(serialized, /null|undefined/);
});

test('builds fiscalized receipt preview with identifiers and invoice line items', () => {
    const model = buildReceiptPreviewModel({
        receiptNumber: '7',
        yearReceiptNumber: '2026-7',
        subtotal: '80.00',
        taxAmount: '20.00',
        totalAmount: '100.00',
        currency: 'eur',
        paymentMethod: 'card',
        paymentReference: 'cs_test',
        jir: 'jir-123',
        zki: 'zki-456',
        cisStatus: 'confirmed',
        cisReference: 'cis-789',
        cisTimestamp: new Date('2026-07-05T10:15:00Z'),
        issuedAt: new Date('2026-07-05T10:15:00Z'),
        businessName: 'Gredice d.o.o.',
        businessPin: '12345678901',
        businessAddress: 'Zagreb',
        customerName: 'Kupac',
        customerAddress: 'Adresa kupca',
        invoice: {
            invoiceNumber: 'PON-TEST',
            status: 'paid',
            subtotal: '80.00',
            taxAmount: '20.00',
            totalAmount: '100.00',
            currency: 'eur',
            issueDate: new Date('2026-07-05T00:00:00Z'),
            dueDate: new Date('2026-07-05T00:00:00Z'),
            invoiceItems: [
                {
                    description: 'Radnja u vrtu',
                    quantity: '1.00',
                    unitPrice: '100.00',
                    totalPrice: '100.00',
                },
            ],
        },
    });

    assert.equal(model.documentLabel, 'Fiskalni račun');
    assert.equal(model.statusLabel, 'Potvrđeno');
    assert.equal(model.lineItems[0]?.description, 'Radnja u vrtu');
    assert.equal(
        model.fiscalization.some((field) => field.value === 'jir-123'),
        true,
    );
    assert.equal(
        model.fiscalization.some((field) => field.value === 'zki-456'),
        true,
    );
});

test('builds receipt preview line item from receipt totals without invoice', () => {
    const model = buildReceiptPreviewModel({
        receiptNumber: '8',
        yearReceiptNumber: '2026-8',
        subtotal: '50.00',
        taxAmount: '0.00',
        totalAmount: '50.00',
        currency: 'eur',
        paymentMethod: 'bank_transfer',
        paymentReference: 'payout-123',
        cisStatus: 'pending',
        issuedAt: new Date('2026-07-05T10:15:00Z'),
        businessName: 'Gredice d.o.o.',
        customerName: 'OPG Horvat',
        invoice: null,
    });

    assert.equal(model.lineItems[0]?.description, 'Fiskalni račun');
    assert.equal(model.lineItems[0]?.quantity, '1');
    assert.equal(model.lineItems[0]?.unitPrice, '50,00\u00a0€');
    assert.equal(model.lineItems[0]?.totalPrice, '50,00\u00a0€');
});

test('parses preview search params with safe defaults', () => {
    assert.deepEqual(parseBillingPreviewSearchParams({}), {
        documentKind: 'invoice',
        invoiceId: '',
        receiptId: '',
        sampleId: 'invoice-normal',
        source: 'sample',
        width: 'document',
    });
    assert.equal(
        parseBillingPreviewSearchParams({
            documentType: 'receipt',
            source: 'receipt',
            width: 'wide',
        }).documentKind,
        'receipt',
    );
});

test('sample documents cover invoice and receipt preview states', () => {
    const invoice = getBillingPreviewSample('invoice', 'invoice-long-line');
    const receipt = getBillingPreviewSample('receipt', 'receipt-fiscalized');

    assert.equal(invoice.kind, 'invoice');
    assert.equal(receipt.kind, 'receipt');
    assert.equal(receipt.fiscalization.length > 0, true);
    assert.match(invoice.lineItems[0]?.description ?? '', /Vrlo dug opis/);
});
