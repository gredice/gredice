import type { AchievementActivity } from '@gredice/js/achievements';
import type { getAccountAchievements } from '@gredice/storage';

export function accountAchievementsResponse(
    accountId: string,
    achievements: Awaited<ReturnType<typeof getAccountAchievements>>,
    activity: AchievementActivity,
) {
    return {
        accountId,
        activity,
        achievements: achievements.map((achievement) => ({
            id: achievement.id,
            key: achievement.achievementKey,
            status: achievement.status,
            rewardSunflowers: achievement.rewardSunflowers,
            progressValue: achievement.progressValue,
            threshold: achievement.threshold,
            earnedAt: achievement.earnedAt.toISOString(),
            approvedAt: achievement.approvedAt?.toISOString() ?? null,
            rewardGrantedAt: achievement.rewardGrantedAt?.toISOString() ?? null,
        })),
    };
}
