import { getAchievementFamilies } from '@gredice/js/achievements';
import {
    GameGardenIcon,
    GameJournalIcon,
    GameProfileIcon,
    GameTrophyIcon,
} from '@gredice/ui/GameIcons';
import { Link } from '@gredice/ui/Link';
import { UserAchievementProgress, UserAvatar } from '@gredice/ui/UserAvatar';
import { KnownPages } from '../../../src/KnownPages';
import {
    formatGardenDate,
    formatGardenNumber,
} from '../../vrtovi/publicGardenFormatting';
import { formatProfileMembership } from './profileMembership';
import { getTopPublicAchievements } from './publicProfile';
import type { PublicProfileData } from './publicProfileData';

const collectionCount = getAchievementFamilies([]).length;

/** Who the gardener is, how far they have come and what there is to see below. */
export function PublicProfileHeader({
    user,
    gardens,
    achievements,
}: PublicProfileData) {
    const membership = formatProfileMembership(user.createdAt);
    const facts = [
        {
            icon: GameTrophyIcon,
            label: 'Postignuća',
            value: formatGardenNumber(user.achievementCount),
        },
        {
            icon: GameJournalIcon,
            label: 'Zbirke',
            value: `${getTopPublicAchievements(achievements).length} / ${collectionCount}`,
        },
        {
            icon: GameGardenIcon,
            label: 'Javni vrtovi',
            value: formatGardenNumber(gardens.length),
        },
    ];

    return (
        <header className="overflow-hidden rounded-3xl border border-b-4 border-tertiary bg-card">
            <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-10">
                <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                    <UserAvatar
                        avatarUrl={user.avatarUrl}
                        achievementCount={user.achievementCount}
                        displayName={user.displayName}
                        size="lg"
                        className="size-20 shrink-0 border-2 border-tertiary text-2xl sm:size-28 sm:text-4xl"
                    />
                    <div className="min-w-0">
                        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground sm:mb-2">
                            <GameProfileIcon
                                aria-hidden
                                className="size-6 shrink-0"
                            />
                            Vrtlarski profil
                        </p>
                        <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
                            {user.displayName}
                        </h1>
                        {membership && (
                            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                                <time
                                    dateTime={user.createdAt}
                                    title={`Pridružio se ${formatGardenDate(user.createdAt)}`}
                                >
                                    {membership}
                                </time>
                            </p>
                        )}
                    </div>
                </div>
                <div className="border-t pt-2 lg:border-l lg:border-t-0 lg:pb-1 lg:pl-10 lg:pt-0">
                    <UserAchievementProgress
                        achievementCount={user.achievementCount}
                    />
                    <Link
                        href={KnownPages.Experience}
                        className="mt-3 inline-block text-sm underline underline-offset-4"
                    >
                        Kako funkcioniraju XP i razine?
                    </Link>
                </div>
            </div>
            <ul className="grid grid-cols-3 divide-x border-t">
                {facts.map(({ icon: Icon, label, value }) => (
                    <li
                        key={label}
                        className="flex flex-col items-center gap-1 px-2 py-4 text-center sm:flex-row sm:justify-center sm:gap-3 sm:px-5 sm:text-left"
                    >
                        <Icon aria-hidden className="size-8 shrink-0" />
                        <p className="min-w-0">
                            <span className="block text-xl font-semibold tabular-nums">
                                {value}
                            </span>
                            <span className="text-xs text-muted-foreground sm:text-sm">
                                {label}
                            </span>
                        </p>
                    </li>
                ))}
            </ul>
        </header>
    );
}
