'use server';

import { getAccount, updateAccountTimeZone } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';

export async function updateAccountTimeZoneAction(
    accountId: string,
    timeZone: string,
) {
    await auth(['admin']);

    if (!accountId) {
        throw new Error('Account ID is required');
    }

    if (!timeZone) {
        throw new Error('Time zone is required');
    }

    await updateAccountTimeZone(accountId, timeZone);
    revalidatePath(`/admin/accounts/${accountId}`);
}

export async function getAccountTimeZone(accountId: string) {
    await auth(['admin']);

    if (!accountId) {
        throw new Error('Account ID is required');
    }

    const account = await getAccount(accountId);
    return account?.timeZone ?? 'Europe/Paris';
}
