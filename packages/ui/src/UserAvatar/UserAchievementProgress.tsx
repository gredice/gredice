import {
    getAchievementDefinitions,
    getAchievementProgress,
} from '@gredice/js/achievements';

export function UserAchievementProgress({
    achievementCount,
}: {
    achievementCount: number;
}) {
    const { level, xp, progress, xpToNextLevel } =
        getAchievementProgress(achievementCount);
    const completed = achievementCount >= getAchievementDefinitions().length;
    const progressPercent = completed ? 100 : Math.floor(progress * 100);
    const progressLabel = completed
        ? 'Sva postignuća osvojena!'
        : `Još ${xpToNextLevel.toLocaleString('hr-HR')} XP do razine ${level + 1}`;
    return (
        <div className="mt-3 max-w-sm space-y-1.5 text-sm">
            <p className="font-medium">
                Razina {level} · {xp.toLocaleString('hr-HR')} XP
            </p>
            <div
                role="progressbar"
                aria-label="Napredak do sljedeće razine"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                aria-valuetext={progressLabel}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
                <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
            <p className="text-xs text-muted-foreground">{progressLabel}</p>
        </div>
    );
}
