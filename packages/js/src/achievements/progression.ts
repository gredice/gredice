export const achievementXp = 100;

/** XP is earned from approved achievements, independently of sunflower rewards. */
export function getAchievementProgress(approvedAchievementCount: number) {
    const achievementCount = Number.isFinite(approvedAchievementCount)
        ? Math.max(0, Math.floor(approvedAchievementCount))
        : 0;
    const xp = achievementCount * achievementXp;
    // Level L starts at 100 * L * (L - 1) / 2 XP.
    const level = Math.floor((1 + Math.sqrt(1 + 8 * achievementCount)) / 2);
    const levelXp = ((level * (level - 1)) / 2) * achievementXp;
    const nextLevelXp = ((level * (level + 1)) / 2) * achievementXp;
    return {
        achievementCount,
        xp,
        level,
        levelXp,
        nextLevelXp,
        xpToNextLevel: nextLevelXp - xp,
        progress: (xp - levelXp) / (nextLevelXp - levelXp),
    };
}
