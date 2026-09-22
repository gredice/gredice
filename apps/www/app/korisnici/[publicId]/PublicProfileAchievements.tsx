import { getAchievementFamilies } from '@gredice/js/achievements';
import {
    AchievementAward,
    AchievementLevelLabel,
} from '@gredice/ui/AchievementAwards';
import { GameTrophyIcon } from '@gredice/ui/GameIcons';
import { Link } from '@gredice/ui/Link';
import { PublicEmptyState } from '../../../components/shared/placeholders/PublicEmptyState';
import { KnownPages } from '../../../src/KnownPages';
import {
    type getPublicProfile,
    getTopPublicAchievements,
} from './publicProfile';

export function PublicProfileAchievements({
    achievements,
}: Pick<Awaited<ReturnType<typeof getPublicProfile>>, 'achievements'>) {
    const topAchievements = getTopPublicAchievements(achievements);
    const families = getAchievementFamilies(achievements);

    return (
        <section
            aria-labelledby="profile-achievements-heading"
            className="text-center"
        >
            <h2
                id="profile-achievements-heading"
                className="mb-6 text-xl font-semibold"
            >
                Postignuća
            </h2>
            {topAchievements.length > 0 ? (
                <ul className="flex flex-wrap justify-center gap-x-6 gap-y-8">
                    {topAchievements.map((definition) => (
                        <li
                            key={definition.category}
                            className="flex w-[calc(50%-0.75rem)] max-w-44 flex-col items-center gap-3"
                        >
                            <AchievementAward
                                achievementKey={definition.key}
                                className="size-28 sm:size-32"
                                aria-hidden
                            />
                            <AchievementLevelLabel
                                level={definition.level}
                                total={
                                    families.find(
                                        (family) =>
                                            family.key === definition.familyKey,
                                    )?.levels.length ?? definition.level
                                }
                            />
                            <div>
                                <h3 className="font-semibold">
                                    {definition.title}
                                </h3>
                                <p className="mt-1 text-sm text-foreground/75">
                                    {definition.description}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <PublicEmptyState icon={GameTrophyIcon}>
                    Još nema otključanih postignuća.
                </PublicEmptyState>
            )}
            <Link
                href={KnownPages.Achievements}
                className="mt-6 inline-block text-sm font-semibold underline underline-offset-4"
            >
                Sva postignuća i kako ih osvojiti
            </Link>
        </section>
    );
}
