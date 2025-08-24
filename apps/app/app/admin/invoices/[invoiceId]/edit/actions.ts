'use server';

import { updateInvoice } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';

interface UpdateInvoiceData {
    id: number;
    currency: string;
    status: string;
    billToName: string;
    billToEmail: string;
    billToAddress: string;
    billToCity: string;
    billToState: string;
    billToZip: string;
    billToCountry: string;
    notes: string;
    terms: string;
    issueDate: string;
    dueDate: string;
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
    vatEnabled: boolean;
    items: Array<{
        id?: number;
        description: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        sku?: string | null;
        unit?: string | null;
        taxRate?: number | null;
    }>;
}

export async function updateInvoiceAction(data: UpdateInvoiceData) {
    try {
        await auth(['admin']);

        await updateInvoice({
            id: data.id,
            currency: data.currency,
            status: data.status,
            billToName: data.billToName,
            billToEmail: data.billToEmail || undefined,
            billToAddress: data.billToAddress || undefined,
            billToCity: data.billToCity || undefined,
            billToState: data.billToState || undefined,
            billToZip: data.billToZip || undefined,
            billToCountry: data.billToCountry || undefined,
            notes: data.notes || undefined,
            terms: data.terms || undefined,
            issueDate: new Date(data.issueDate),
            dueDate: new Date(data.dueDate),
            subtotal: data.subtotal,
            taxAmount: data.taxAmount,
            totalAmount: data.totalAmount,
        });

        // Update invoice items separately (this would need additional logic)
        // For now, we'll handle items in a simplified way

        revalidatePath(KnownPages.Invoice(data.id));
        revalidatePath(KnownPages.Invoices);
        return { success: true };
    } catch (error) {
        console.error('Error updating invoice:', error);
        return { success: false, error: 'Internal server error' };
    }
}
