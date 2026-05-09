'use server';

import { getAccountGardens, getAccountUsers } from '@gredice/storage';
import { auth } from '../../lib/auth/auth';

export async function getAccountData(accountId: string) {
    await auth(['admin']);

    if (!accountId) {
        throw new Error('Account ID is required');
    }

    const [users, gardens] = await Promise.all([
        getAccountUsers(accountId),
        getAccountGardens(accountId),
    ]);

    return {
        users: users.map((u) => ({
            id: u.user.id,
            userName: u.user.userName,
        })),
        gardens: gardens.map((g) => ({
            id: g.id,
            name: g.name,
        })),
    };
}
