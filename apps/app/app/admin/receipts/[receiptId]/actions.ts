'use server';

import { softDeleteReceipt, getReceipt, updateReceiptFiscalization, getAllFiscalizationSettings } from "@gredice/storage";
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

    if (!receipt.invoice) {
        throw new Error('Invoice not found for receipt');
    }

    if (!receipt.invoice.accountId) {
        throw new Error('Account not found for invoice');
    }

    // Get fiscalization settings for the account
    const fiscalizationSettings = await getAllFiscalizationSettings(receipt.invoice.accountId);

    if (!fiscalizationSettings.userSettings) {
        throw new Error('Fiscalization user settings not found for account');
    }

    if (!fiscalizationSettings.posSettings) {
        throw new Error('Fiscalization POS settings not found for account');
    }

    try {
        const fiscalResult = await receiptRequest({
            date: receipt.issuedAt,
            receiptNumber: receipt.receiptNumber,
            totalAmount: Number(receipt.totalAmount),
        }, {
            posSettings: {
                posId: fiscalizationSettings.posSettings.posId,
                premiseId: fiscalizationSettings.posSettings.premiseId
            },
            posUser: {
                posPin: fiscalizationSettings.userSettings.pin
            },
            userSettings: {
                pin: fiscalizationSettings.userSettings.pin,
                environment: fiscalizationSettings.userSettings.environment as 'educ' | 'prod',
                useVat: fiscalizationSettings.userSettings.useVat,
                credentials: {
                    password: fiscalizationSettings.userSettings.certPassword,
                    cert: Buffer.from(fiscalizationSettings.userSettings.certBase64, 'base64').toString('binary')
                },
                receiptNumberOnDevice: fiscalizationSettings.userSettings.receiptNumberOnDevice
            }
        });

        await updateReceiptFiscalization(receiptId, {
            jir: fiscalResult.jir,
            zki: fiscalResult.zki,
            cisTimestamp: fiscalResult.dateTime,
            cisStatus: 'confirmed',
            cisErrorMessage: null,
            cisReference: fiscalResult.receiptNumber, // Assuming receiptNumber is the reference
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