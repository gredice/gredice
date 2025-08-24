'use server';
import 'server-only';
import { deleteNotification as storageDeleteNotification } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { KnownPages } from '../../../src/KnownPages';

export async function deleteNotification(
    accountId: string,
    userId: string | null | undefined,
    id: string,
) {
    await storageDeleteNotification(id);
    revalidatePath(KnownPages.Account(accountId));
    if (userId) {
        revalidatePath(KnownPages.User(userId));
    }
}