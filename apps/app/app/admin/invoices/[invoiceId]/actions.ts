'use server';

import { changeInvoiceStatus, cancelInvoice, softDeleteInvoice, InvoiceStatus, createReceiptFromInvoice, getReceiptByInvoice } from "@gredice/storage";
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

export async function createReceiptAction(invoiceId: number) {
    await auth(['admin']);

    try {
        const receiptId = await createReceiptFromInvoice(invoiceId, {
            paymentMethod: 'card', // Default payment method - could be made configurable
            businessPin: '12345678901', // Default business PIN - should be configured
            businessName: 'Gredice d.o.o.', // Default business name - should be configured  
            businessAddress: 'Adresa 1, 10000 Zagreb, Hrvatska', // Default address - should be configured
        });

        redirect(KnownPages.Receipt(receiptId));
    } catch (error) {
        console.error('Error creating receipt:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create receipt'
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
            error: error instanceof Error ? error.message : 'Failed to get receipt'
        };
    }
}
