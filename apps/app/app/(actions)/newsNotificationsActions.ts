'use server';

import { createNotification, getAccounts } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

type TargetMode = 'all' | 'selected';

type SendNewsNotificationState = {
    success: boolean;
    createdCount?: number;
    error?: string;
};

export async function sendNewsNotificationAction(
    _prevState: SendNewsNotificationState | null,
    formData: FormData,
): Promise<SendNewsNotificationState> {
    await auth(['admin']);

    const target = (formData.get('target') as TargetMode) ?? 'all';
    const newsType = (formData.get('newsType') as string) ?? 'new-operation';
    const content = (formData.get('content') as string)?.trim();

    let accountIds: string[] = [];
    if (target === 'all') {
        const accounts = await getAccounts();
        accountIds = accounts.map((account) => account.id);
    } else {
        accountIds = formData
            .getAll('accountIds')
            .map((value) => value.toString())
            .filter(Boolean);
    }

    if (!content) {
        return { success: false, error: 'Unesite sadržaj obavijesti.' };
    }

    if (accountIds.length === 0) {
        return { success: false, error: 'Odaberite barem jedan račun.' };
    }

    const header =
        newsType === 'new-operation' ? 'Nova radnja dostupna' : 'Novost';

    const timestamp = new Date();

    await Promise.all(
        accountIds.map((accountId) =>
            createNotification({
                header,
                content,
                iconUrl: undefined,
                imageUrl: undefined,
                linkUrl: KnownPages.GrediceOperations,
                accountId,
                userId: undefined,
                gardenId: undefined,
                raisedBedId: undefined,
                blockId: undefined,
                timestamp,
                readAt: null,
                readWhere: undefined,
            }),
        ),
    );

    for (const accountId of accountIds) {
        revalidatePath(KnownPages.Account(accountId));
    }
    revalidatePath(KnownPages.Notifications);

    return { success: true, createdCount: accountIds.length };
}
