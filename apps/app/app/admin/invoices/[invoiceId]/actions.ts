'use server';

import {
    cancelInvoice,
    changeInvoiceStatus,
    createReceiptFromInvoice,
    getFiscalizationUserSettings,
    getInvoice,
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

    try {
        // TODO: Retrieve from settings
        const invoice = await getInvoice(invoiceId);
        const userSettings = await getFiscalizationUserSettings();
        if (!userSettings) {
            throw new Error('Fiscalization user settings not found');
        }

        const receiptId = await createReceiptFromInvoice(invoiceId, {
            paymentMethod: 'card',
            businessPin: userSettings.pin,
            businessName: 'Gredice d.o.o.',
            businessAddress: 'Ulica Julija Knifera 3, 10000 Zagreb, Hrvatska',
            customerAddress: invoice?.billToAddress,
            customerName: invoice?.billToName,
            paymentReference: invoice?.transactionId?.toString(),
        });

        redirect(KnownPages.Receipt(receiptId));
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
