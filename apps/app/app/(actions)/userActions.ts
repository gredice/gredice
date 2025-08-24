'use server';

import {
    clearLoginFailedAttempts,
    updateUserRole as storageUpdateUserRole,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function updateUserRole(userId: string, newRole: string) {
    await auth(['admin']);

    await storageUpdateUserRole(userId, newRole);
    revalidatePath(KnownPages.Users);
}

export async function unblockUserLogin(loginId: number) {
    await auth(['admin']);

    await clearLoginFailedAttempts(loginId);
    revalidatePath(KnownPages.Users);
}
