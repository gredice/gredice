'use server';

import { createPayoutRequest } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';

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
