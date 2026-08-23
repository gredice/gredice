import type {
    InvoiceForTransactionBillingSnapshot,
    InvoiceForTransactionLineItem,
} from '@gredice/storage';

export interface CheckoutInvoiceLineInput {
    amountTotalCents: number | null | undefined;
    entityId?: string | null;
    entityTypeName?: string | null;
    metadataName?: string | null;
    outletOfferId?: string | number | null;
    outletSowingDate?: string | null;
    productName?: string | null;
    quantity?: number | null;
}

export interface CheckoutInvoiceBillingInput {
    customerEmail?: string | null;
    customerName?: string | null;
}

function cleanText(value: string | null | undefined) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : undefined;
}

function safeQuantity(value: number | null | undefined) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : 1;
}

export function buildCheckoutInvoiceLineItem({
    amountTotalCents,
    entityId,
    entityTypeName,
    metadataName,
    outletOfferId,
    outletSowingDate,
    productName,
    quantity,
}: CheckoutInvoiceLineInput): InvoiceForTransactionLineItem | null {
    if (
        !Number.isInteger(amountTotalCents) ||
        typeof amountTotalCents !== 'number' ||
        amountTotalCents < 0
    ) {
        return null;
    }

    const quantityValue = safeQuantity(quantity);
    const outletSuffix = outletOfferId
        ? ` (Outlet #${outletOfferId}${
              outletSowingDate
                  ? `, sjetva ${outletSowingDate.slice(0, 10)}`
                  : ''
          })`
        : '';
    const baseDescription =
        cleanText(productName) ?? cleanText(metadataName) ?? 'Plaćena narudžba';

    return {
        description: `${baseDescription}${outletSuffix}`,
        quantity: quantityValue,
        unitPriceCents: Math.round(amountTotalCents / quantityValue),
        totalPriceCents: amountTotalCents,
        entityId: cleanText(entityId),
        entityTypeName: cleanText(entityTypeName),
    };
}

export function buildCheckoutInvoiceBillingSnapshot({
    customerEmail,
    customerName,
}: CheckoutInvoiceBillingInput): InvoiceForTransactionBillingSnapshot {
    return {
        billToEmail: cleanText(customerEmail),
        billToName: cleanText(customerName),
        billToCountry: 'Hrvatska',
        notes: 'Generirano iz plaćene Gredice checkout transakcije.',
    };
}
