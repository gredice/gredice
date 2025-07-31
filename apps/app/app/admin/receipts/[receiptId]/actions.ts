'use server';

import { softDeleteReceipt, getReceipt, updateReceiptFiscalization } from "@gredice/storage";
import { auth } from "../../../../lib/auth/auth";
import { redirect } from "next/navigation";
import { KnownPages } from "../../../../src/KnownPages";
import { receiptRequest } from '@gredice/fiscalization';
import { revalidatePath } from "next/cache";

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

export async function fiscalizeReceiptAction(receiptId: number) {
    await auth(['admin']);

    const receipt = await getReceipt(receiptId);
    if (!receipt) {
        throw new Error('Receipt not found');
    }

    try {
        const fiscalResult = await receiptRequest({
            date: receipt.issuedAt,
            receiptNumber: receipt.receiptNumber,
            totalAmount: Number(receipt.totalAmount),
        }, {
            posSettings: {
                posId: '', // TODO
                premiseId: '' // TODO
            },
            posUser: {
                posPin: ''// TODO
            },
            userSettings: {
                pin: '', // TODO
                environment: 'educ',
                useVat: false,
                credentials: {
                    password: '', // TODO
                    cert: '' // TODO
                },
                receiptNumberOnDevice: false
            }
        });

        await updateReceiptFiscalization(receiptId, {
            jir: fiscalResult.jir,
            zki: fiscalResult.zki,
            cisTimestamp: fiscalResult.dateTime,
            cisStatus: 'confirmed'
        });
    } catch (error) {
        console.error('Error fiscalizing receipt:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fiscalize receipt';
        await updateReceiptFiscalization(receiptId, {
            cisStatus: 'failed',
            cisErrorMessage: errorMessage,
            cisTimestamp: new Date()
        });
    }

    revalidatePath(KnownPages.Receipt(receiptId));
}