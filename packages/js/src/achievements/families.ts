import {
    type AchievementCategory,
    type AchievementStatus,
    getAchievementDefinitions,
} from './definitions';

export type AchievementRecord = {
    key: string;
    status: AchievementStatus;
    rewardSunflowers?: number;
    rewardGrantedAt?: string | null;
    earnedAt?: string | null;
    approvedAt?: string | null;
};

export const achievementFamilyLabels: Record<AchievementCategory, string> = {
    registration: 'Dobrodošlica',
    planting: 'Sadnja',
    watering: 'Zalijevanje',
    harvest: 'Berba',
    community_editing: 'Doprinos zajednici',
};

/** Award snapshots describe earned milestones, never live action totals. */
export function getAchievementFamilies<T extends AchievementRecord>(
    achievements: readonly T[],
) {
    const byKey = new Map(
        achievements.map((achievement) => [achievement.key, achievement]),
    );
    const definitions = getAchievementDefinitions().sort(
        (a, b) => a.sortOrder - b.sortOrder,
    );
    const categories = [
        ...new Set(definitions.map((definition) => definition.familyKey)),
    ];
    return categories.map((key) => {
        const levels = definitions
            .filter((definition) => definition.familyKey === key)
            .map((definition) => ({
                definition,
                achievement: byKey.get(definition.key),
            }));
        const approved = levels.filter(
            (level) => level.achievement?.status === 'approved',
        );
        const highestApproved = approved.at(-1);
        return {
            key,
            label: achievementFamilyLabels[key],
            levels,
            highestApproved,
            nextLevel: levels.find(
                (level) =>
                    level.definition.level >
                    (highestApproved?.definition.level ?? 0),
            ),
            approvedCount: approved.length,
            pendingCount: levels.filter(
                (level) => level.achievement?.status === 'pending',
            ).length,
            isComplete: approved.length === levels.length,
        };
    });
}

export type AchievementFamily = ReturnType<
    typeof getAchievementFamilies<AchievementRecord>
>[number];
