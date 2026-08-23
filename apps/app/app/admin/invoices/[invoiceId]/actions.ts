'use server';

import { issueReceiptForPaidInvoice } from '@gredice/fiscalization/server';
import {
    cancelInvoice,
    changeInvoiceStatus,
    getReceiptByInvoice,
    type InvoiceStatus,
    softDeleteInvoice,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

export async function changeInvoiceStatusAction(
    invoiceId: number,
    newStatus: InvoiceStatus,
) {
    await auth(['admin']);

    try {
        await changeInvoiceStatus(invoiceId, newStatus);
        revalidatePath(KnownPages.Invoice(invoiceId));
        return { success: true };
    } catch (error) {
        console.error('Error changing invoice status:', error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to change invoice status',
        };
    }
}

export async function cancelInvoiceAction(invoiceId: number) {
    await auth(['admin']);

    try {
        await cancelInvoice(invoiceId);
        revalidatePath(KnownPages.Invoice(invoiceId));
        return { success: true };
    } catch (error) {
        console.error('Error cancelling invoice:', error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to cancel invoice',
        };
    }
}

export async function deleteInvoiceAction(invoiceId: number) {
    await auth(['admin']);

    try {
        await softDeleteInvoice(invoiceId);
        revalidatePath(KnownPages.Invoices);
        redirect(KnownPages.Invoices);
    } catch (error) {
        console.error('Error deleting invoice:', error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to delete invoice',
        };
    }
}

export async function createReceiptAction(invoiceId: number) {
    await auth(['admin']);

    let receiptId: number;
    try {
        const result = await issueReceiptForPaidInvoice({ invoiceId });
        if (result.status === 'skipped') {
            throw new Error(result.message);
        }

        receiptId = result.receiptId;
    } catch (error) {
        console.error('Error creating receipt:', error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to create receipt',
        };
    }

    redirect(KnownPages.Receipt(receiptId));
}

export async function getInvoiceReceiptAction(invoiceId: number) {
    await auth(['admin']);

    try {
        const receipt = await getReceiptByInvoice(invoiceId);
        return { success: true, receipt };
    } catch (error) {
        console.error('Error getting receipt:', error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to get receipt',
        };
    }
}
