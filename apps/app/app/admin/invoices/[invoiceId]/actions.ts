'use server';

import { changeInvoiceStatus, cancelInvoice, softDeleteInvoice, InvoiceStatus } from "@gredice/storage";
import { auth } from "../../../../lib/auth/auth";
import { redirect } from "next/navigation";
import { KnownPages } from "../../../../src/KnownPages";

export async function changeInvoiceStatusAction(invoiceId: number, newStatus: InvoiceStatus) {
    await auth(['admin']);

    try {
        await changeInvoiceStatus(invoiceId, newStatus);
        return { success: true };
    } catch (error) {
        console.error('Error changing invoice status:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to change invoice status'
        };
    }
}

export async function cancelInvoiceAction(invoiceId: number) {
    await auth(['admin']);

    try {
        await cancelInvoice(invoiceId);
        return { success: true };
    } catch (error) {
        console.error('Error cancelling invoice:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cancel invoice'
        };
    }
}

export async function deleteInvoiceAction(invoiceId: number) {
    await auth(['admin']);

    try {
        await softDeleteInvoice(invoiceId);
        redirect(KnownPages.Invoices);
    } catch (error) {
        console.error('Error deleting invoice:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete invoice'
        };
    }
}
