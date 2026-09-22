import type { AchievementCategory } from './definitions';

/** Current verified activity; award progressValue remains a historical snapshot. */
export type AchievementActivityCategory = Exclude<
    AchievementCategory,
    'registration' | 'seasonal'
>;

export type AchievementActivity = {
    calculatedAt: string;
    counts: Record<AchievementActivityCategory, number>;
};
