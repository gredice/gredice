import { getAchievementFamilies } from '@gredice/js/achievements';
import {
    AchievementAward,
    AchievementLevelLabel,
} from '@gredice/ui/AchievementAwards';

export function AchievementAwardsShowcase({
    dark = false,
}: {
    dark?: boolean;
}) {
    return (
        <div
            className={`${dark ? 'dark' : ''} min-h-screen bg-background p-4 text-foreground sm:p-8`}
        >
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold">
                        Achievement awards
                    </h1>
                    <p className="text-foreground/75">
                        34 individual awards. Starter keepsakes grow into garden
                        trophies with distinct silhouettes. Compare every level
                        at 32, 64 and 160 pixels.
                    </p>
                </header>
                {getAchievementFamilies([]).map((family) => (
                    <section key={family.key} className="space-y-4">
                        <h2 className="text-xl font-semibold">
                            {family.label}
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {family.levels.map(({ definition }) => (
                                <article
                                    key={definition.key}
                                    data-award-example={definition.key}
                                    className="space-y-3 rounded-xl border bg-card p-4"
                                >
                                    <div className="flex items-end justify-center gap-2">
                                        <AchievementAward
                                            achievementKey={definition.key}
                                            width={32}
                                            height={32}
                                        />
                                        <AchievementAward
                                            achievementKey={definition.key}
                                            width={64}
                                            height={64}
                                            aria-hidden
                                        />
                                        <AchievementAward
                                            achievementKey={definition.key}
                                            width={160}
                                            height={160}
                                            aria-hidden
                                        />
                                    </div>
                                    <AchievementLevelLabel
                                        level={definition.level}
                                        total={family.levels.length}
                                    />
                                    <h3 className="font-semibold">
                                        {definition.title.trim()}
                                    </h3>
                                    <p className="text-sm text-foreground/75">
                                        {definition.description}
                                    </p>
                                    <code className="text-xs text-foreground/75">
                                        {definition.artworkKey} ·{' '}
                                        {definition.visualGrade}
                                    </code>
                                </article>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
