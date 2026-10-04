import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildCheckoutInvoiceBillingSnapshot,
    buildCheckoutInvoiceLineItem,
} from './checkoutInvoiceDraft';

test('buildCheckoutInvoiceLineItem maps paid Stripe item cents safely', () => {
    const item = buildCheckoutInvoiceLineItem({
        amountTotalCents: 2500,
        entityId: '42',
        entityTypeName: 'operation',
        outletOfferId: '77',
        outletSowingDate: '2026-07-05T00:00:00.000Z',
        productName: 'Sadnja rajčice',
        quantity: 2,
    });

    assert.deepEqual(item, {
        description: 'Sadnja rajčice (Outlet #77, sjetva 2026-07-05)',
        entityId: '42',
        entityTypeName: 'operation',
        quantity: 2,
        unitPriceCents: 1250,
        totalPriceCents: 2500,
    });
});

test('buildCheckoutInvoiceLineItem returns null for missing Stripe amount', () => {
    assert.equal(
        buildCheckoutInvoiceLineItem({
            amountTotalCents: null,
            productName: 'Narudžba',
            quantity: 1,
        }),
        null,
    );
});

test('buildCheckoutInvoiceBillingSnapshot keeps customer-safe fields only', () => {
    assert.deepEqual(
        buildCheckoutInvoiceBillingSnapshot({
            customerEmail: ' kupac@example.com ',
            customerName: ' Kupac ',
        }),
        {
            billToCountry: 'Hrvatska',
            billToEmail: 'kupac@example.com',
            billToName: 'Kupac',
            notes: 'Generirano iz plaćene Gredice checkout transakcije.',
        },
    );
});
