'use server';

import {
    createPayoutRequest,
    getFarmerBalance,
    getFarmerPayoutRequests,
    getFarms,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';

export async function getMyBalance() {
    const { userId } = await auth(['farmer', 'admin']);
    const farms = await getFarms();
    if (farms.length === 0) return null;

    // Return balance for first farm the user belongs to
    // In practice most farmers belong to one farm
    const balances = await Promise.all(
        farms.map((farm) => getFarmerBalance(userId, farm.id)),
    );

    // Aggregate across farms
    const combined = balances.reduce(
        (acc, b) => ({
            totalEarned: acc.totalEarned + b.totalEarned,
            totalPaid: acc.totalPaid + b.totalPaid,
            totalPending: acc.totalPending + b.totalPending,
            availableBalance: acc.availableBalance + b.availableBalance,
            currency: b.currency,
            earningsByType: [...acc.earningsByType, ...b.earningsByType],
        }),
        {
            totalEarned: 0,
            totalPaid: 0,
            totalPending: 0,
            availableBalance: 0,
            currency: 'eur',
            earningsByType: [] as { entityTypeName: string; operationCount: number; pricePerUnit: number; totalEarned: number; currency: string }[],
        },
    );

    return combined;
}

export async function getMyBalanceForFarm(farmId: number) {
    const { userId } = await auth(['farmer', 'admin']);
    return getFarmerBalance(userId, farmId);
}

export async function getMyPayouts() {
    const { userId } = await auth(['farmer', 'admin']);
    return getFarmerPayoutRequests(userId);
}

export async function requestPayoutAction(
    farmId: number,
    amount: number,
    currency: string,
    note?: string,
) {
    const { userId } = await auth(['farmer', 'admin']);
    await createPayoutRequest(userId, farmId, amount, currency, note);
    revalidatePath('/payouts');
}
