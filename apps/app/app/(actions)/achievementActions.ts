'use server';

import { approveAchievement, denyAchievement } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function approveAchievementAction(achievementId: number) {
    const { userId } = await auth(['admin']);
    const achievement = await approveAchievement(achievementId, userId);
    revalidatePath(KnownPages.Achievements);
    revalidatePath(KnownPages.Account(achievement.accountId));
}

export async function denyAchievementAction(achievementId: number) {
    const { userId } = await auth(['admin']);
    const achievement = await denyAchievement(achievementId, userId);
    revalidatePath(KnownPages.Achievements);
    revalidatePath(KnownPages.Account(achievement.accountId));
}
