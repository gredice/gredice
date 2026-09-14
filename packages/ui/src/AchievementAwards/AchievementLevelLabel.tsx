import { formatAchievementLevel } from '@gredice/js/achievements';

export function AchievementLevelLabel({
    level,
    total,
}: {
    level: number;
    total: number;
}) {
    return (
        <span className="text-xs font-semibold tabular-nums text-foreground/75">
            Razina {formatAchievementLevel(level)} /{' '}
            {formatAchievementLevel(total)}
        </span>
    );
}
