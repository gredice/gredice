'use server';

import { softDeleteReceipt, getReceipt } from "@gredice/storage";
import { auth } from "../../../../lib/auth/auth";
import { redirect } from "next/navigation";
import { KnownPages } from "../../../../src/KnownPages";

export async function deleteReceiptAction(receiptId: number) {
    await auth(['admin']);

    try {
        // Get receipt to check if it can be deleted
        const receipt = await getReceipt(receiptId);
        if (!receipt) {
            return {
                success: false,
                error: 'Receipt not found'
            };
        }

        // Don't allow deletion of fiscalized receipts
        if (receipt.cisStatus === 'sent' || receipt.cisStatus === 'confirmed') {
            return {
                success: false,
                error: 'Cannot delete fiscalized receipts'
            };
        }

        await softDeleteReceipt(receiptId);
        redirect(KnownPages.Receipts);
    } catch (error) {
        console.error('Error deleting receipt:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete receipt'
        };
    }
}
