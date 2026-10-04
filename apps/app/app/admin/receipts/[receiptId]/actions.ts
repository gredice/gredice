'use server';

import { fiscalizeReceipt } from '@gredice/fiscalization/server';
import { getReceipt, softDeleteReceipt } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

export async function deleteReceiptAction(receiptId: number) {
    await auth(['admin']);

    try {
        // Get receipt to check if it can be deleted
        const receipt = await getReceipt(receiptId);
        if (!receipt) {
            return {
                success: false,
                error: 'Receipt not found',
            };
        }

        // Don't allow deletion of fiscalized receipts
        if (receipt.cisStatus === 'sent' || receipt.cisStatus === 'confirmed') {
            return {
                success: false,
                error: 'Cannot delete fiscalized receipts',
            };
        }

        await softDeleteReceipt(receiptId);
        redirect(KnownPages.Receipts);
    } catch (error) {
        console.error('Error deleting receipt:', error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to delete receipt',
        };
    }
}

export async function fiscalizeReceiptAction(receiptId: number) {
    await auth(['admin']);

    const result = await fiscalizeReceipt(receiptId);
    if (result.status === 'skipped') {
        throw new Error(result.message);
    }
    if (result.status === 'failed') {
        console.warn('Receipt fiscalization failed', {
            reason: result.reason,
            receiptId,
        });
    }

    revalidatePath(KnownPages.Receipt(receiptId));
}
