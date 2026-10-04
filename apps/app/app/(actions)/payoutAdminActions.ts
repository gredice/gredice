'use server';

import {
    approvePayoutRequest,
    deleteOperationPrice,
    getAllPayoutRequests,
    getFarmerBalance,
    markPayoutAsPaid,
    type PayoutAdjustmentInput,
    rejectPayoutRequest,
    upsertOperationPrice,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function approvePayoutAction(
    id: number,
    adminNote?: string,
    adjustments?: PayoutAdjustmentInput[],
) {
    const { userId } = await auth(['admin']);
    await approvePayoutRequest(id, userId, adminNote, adjustments);
    revalidatePath(KnownPages.FarmerPayouts);
}

export async function rejectPayoutAction(id: number, reason?: string) {
    await auth(['admin']);
    await rejectPayoutRequest(id, reason);
    revalidatePath(KnownPages.FarmerPayouts);
}

export async function markPayoutAsPaidAction(
    id: number,
    bankReference: string,
    farmerName?: string,
) {
    await auth(['admin']);
    const result = await markPayoutAsPaid(id, bankReference, {
        farmerName: farmerName ?? null,
    });
    revalidatePath(KnownPages.FarmerPayouts);
    return result;
}

export async function setOperationPriceAction(
    farmId: number,
    entityTypeName: string,
    pricePerUnit: string,
    entityId?: number | null,
) {
    await auth(['admin']);
    const price = parseFloat(pricePerUnit);
    if (Number.isNaN(price) || price < 0) {
        throw new Error('Nevažeća cijena.');
    }
    await upsertOperationPrice({
        farmId,
        entityTypeName,
        entityId: entityId ?? null,
        pricePerUnit: price.toFixed(2),
        currency: 'eur',
    });
    revalidatePath(KnownPages.FarmerPrices);
}

export async function deleteOperationPriceAction(id: number) {
    await auth(['admin']);
    await deleteOperationPrice(id);
    revalidatePath(KnownPages.FarmerPrices);
}

export async function getAdminPayouts(filter?: {
    status?: 'pending' | 'approved' | 'paid' | 'rejected';
    farmId?: number;
}) {
    await auth(['admin']);
    return getAllPayoutRequests(filter);
}

export async function getFarmerBalanceAdmin(userId: string, farmId: number) {
    await auth(['admin']);
    return getFarmerBalance(userId, farmId);
}
