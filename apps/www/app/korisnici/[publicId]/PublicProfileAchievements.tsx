import { getAchievementFamilies } from '@gredice/js/achievements';
import {
    AchievementAward,
    AchievementLevelLabel,
} from '@gredice/ui/AchievementAwards';
import { GameTrophyIcon } from '@gredice/ui/GameIcons';
import { Link } from '@gredice/ui/Link';
import { PublicEmptyState } from '../../../components/shared/placeholders/PublicEmptyState';
import { KnownPages } from '../../../src/KnownPages';
import { getTopPublicAchievements } from './publicProfile';
import type { PublicProfileData } from './publicProfileData';

export function PublicProfileAchievements({
    achievements,
}: Pick<PublicProfileData, 'achievements'>) {
    const topAchievements = getTopPublicAchievements(achievements);
    const families = getAchievementFamilies(achievements);

    return (
        <section aria-labelledby="profile-achievements-heading">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div>
                    <h2
                        id="profile-achievements-heading"
                        className="text-2xl font-semibold"
                    >
                        Postignuća
                    </h2>
                    {topAchievements.length > 0 && (
                        <p className="mt-1 text-muted-foreground">
                            Najviša osvojena razina u svakoj zbirci.
                        </p>
                    )}
                </div>
                <Link
                    href={KnownPages.Achievements}
                    className="text-sm font-semibold underline underline-offset-4"
                >
                    Sva postignuća i kako ih osvojiti
                </Link>
            </div>
            {topAchievements.length > 0 ? (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {topAchievements.map((definition) => {
                        const family = families.find(
                            (item) => item.key === definition.familyKey,
                        );
                        return (
                            <li
                                key={definition.category}
                                className="relative flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary hover:bg-muted/60 motion-reduce:transition-none sm:p-5"
                            >
                                <AchievementAward
                                    achievementKey={definition.key}
                                    className="size-20 shrink-0 sm:size-24"
                                    aria-hidden
                                />
                                <div className="min-w-0">
                                    {family && (
                                        <p className="text-sm text-muted-foreground">
                                            {family.label}
                                        </p>
                                    )}
                                    <h3 className="font-semibold leading-snug">
                                        <Link
                                            href={`${KnownPages.Achievements}#${definition.key}`}
                                            className="outline-hidden after:absolute after:inset-0 after:rounded-2xl"
                                        >
                                            {definition.title.trim()}
                                        </Link>
                                    </h3>
                                    <AchievementLevelLabel
                                        level={definition.level}
                                        total={
                                            family?.levels.length ??
                                            definition.level
                                        }
                                    />
                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                        {definition.description}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <PublicEmptyState
                    icon={GameTrophyIcon}
                    className="rounded-2xl border border-dashed py-10"
                >
                    Još nema otključanih postignuća.
                </PublicEmptyState>
            )}
        </section>
    );
}
