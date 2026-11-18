import {
    achievementXp,
    getAchievementProgress,
} from '@gredice/js/achievements';
import { croatianPlural } from '@gredice/js/i18n';
import { Avatar } from '@gredice/ui/Avatar';
import { GameTrophyIcon } from '@gredice/ui/GameIcons';
import { Link } from '@gredice/ui/Link';
import { publicUserProfileHref } from '@gredice/ui/PublicChrome';
import { UserAvatar, UserLevelBadge } from '@gredice/ui/UserAvatar';
import { cx } from '@gredice/ui/utils';
import { CtaBand } from '../../components/shared/CtaBand';
import { KnownPages } from '../../src/KnownPages';
import type { getUserLeaderboard } from './leaderboard';

/** Gold, silver and bronze for the first three places. */
const podiumStyles = [
    {
        row: 'bg-amber-50/70 dark:bg-amber-950/25',
        medal: 'shadow-sm ring-2 bg-amber-400 text-amber-950 ring-amber-500/50',
    },
    {
        row: 'bg-slate-100/70 dark:bg-slate-800/30',
        medal: 'shadow-sm ring-2 bg-slate-300 text-slate-900 ring-slate-400/60',
    },
    {
        row: 'bg-orange-50/70 dark:bg-orange-950/25',
        medal: 'shadow-sm ring-2 bg-amber-700 text-amber-50 ring-amber-800/50',
    },
];

/** Avatars shown in the stack for gardeners outside the top ten. */
export const maxCommunityAvatars = 5;

export function UserLeaderboard({
    items,
    userCount,
    communityAvatarUrls = [],
}: Pick<Awaited<ReturnType<typeof getUserLeaderboard>>, 'items'> & {
    /** Registered gardeners; older API responses may not include it. */
    userCount?: number;
    communityAvatarUrls?: string[];
}) {
    const otherUserCount = Math.max(0, (userCount ?? 0) - items.length);
    return (
        <div className="mx-auto max-w-4xl py-10 sm:py-16">
            <header className="mb-10 max-w-2xl">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <GameTrophyIcon aria-hidden className="size-6" /> Naša
                    zajednica
                </p>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                    Vrtlari koji rastu zajedno
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                    Upoznaj 10 korisnika s najviše odobrenih postignuća. Svaka
                    sadnja, zalijevanje i berba korak su prema novoj razini.
                </p>
            </header>
            <section aria-labelledby="leaderboard-title">
                <h2
                    id="leaderboard-title"
                    className="mb-4 text-xl font-semibold"
                >
                    Top 10 vrtlara
                </h2>
                {items.length ? (
                    <>
                        <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
                            {items.map((user, index) => {
                                const { level, xp } = getAchievementProgress(
                                    user.achievementCount,
                                );
                                const podium = podiumStyles[index];
                                return (
                                    <li key={user.publicId}>
                                        <Link
                                            href={publicUserProfileHref(
                                                user.publicId,
                                            )}
                                            className={cx(
                                                'group flex items-center gap-3 px-3 py-5 transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:gap-5 sm:px-6',
                                                podium?.row,
                                            )}
                                        >
                                            <span
                                                className={cx(
                                                    'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                                                    podium?.medal ??
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                {index + 1}
                                            </span>
                                            <UserAvatar
                                                avatarUrl={user.avatarUrl}
                                                displayName={user.displayName}
                                                achievementCount={
                                                    user.achievementCount
                                                }
                                                size="lg"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <span className="block break-words font-semibold group-hover:underline">
                                                    {user.displayName}
                                                </span>
                                                <span className="mt-1 block text-xs text-muted-foreground sm:text-sm">
                                                    Razina {level} ·{' '}
                                                    {xp.toLocaleString('hr-HR')}{' '}
                                                    XP
                                                </span>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className="block text-xl font-semibold tabular-nums">
                                                    {user.achievementCount}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    postignuća
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ol>
                        {otherUserCount ? (
                            <div className="mt-4 flex items-center gap-3 px-3 sm:px-6">
                                {communityAvatarUrls.length ? (
                                    <div
                                        aria-hidden
                                        className="flex shrink-0 -space-x-3"
                                    >
                                        {communityAvatarUrls
                                            .slice(
                                                0,
                                                Math.min(
                                                    maxCommunityAvatars,
                                                    otherUserCount,
                                                ),
                                            )
                                            .map((avatarUrl) => (
                                                <Avatar
                                                    key={avatarUrl}
                                                    src={avatarUrl}
                                                    alt=""
                                                    className="ring-2 ring-background"
                                                />
                                            ))}
                                    </div>
                                ) : null}
                                <p className="text-sm font-semibold text-muted-foreground">
                                    i još{' '}
                                    {otherUserCount.toLocaleString('hr-HR')}{' '}
                                    {croatianPlural(otherUserCount, {
                                        one: 'vrtlar',
                                        few: 'vrtlara',
                                        many: 'vrtlara',
                                    })}
                                </p>
                            </div>
                        ) : null}
                    </>
                ) : (
                    <p className="rounded-2xl border bg-muted/30 p-8 text-muted-foreground">
                        Ljestvica čeka prva odobrena postignuća. Započni svoj
                        vrt i pridruži se zajednici!
                    </p>
                )}
            </section>
            <section
                aria-labelledby="levels-title"
                className="mt-10 border-t pt-8"
            >
                <h2 id="levels-title" className="text-xl font-semibold">
                    Kako raste tvoja razina?
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Svako odobreno postignuće donosi {achievementXp} XP. Za
                    svaku sljedeću razinu potrebno je više iskustva. XP ostaje
                    uz tvoja postignuća i ne troši se kupnjom suncokreta.
                </p>
                <Link
                    href={KnownPages.Experience}
                    className="mt-4 inline-block text-sm underline underline-offset-4"
                >
                    Kako skupljati XP i prijeći na novu razinu
                </Link>
                <ul
                    className="mt-5 flex flex-wrap gap-x-6 gap-y-4"
                    aria-label="Primjeri razina"
                >
                    {[1, 3, 5, 7].map((level) => (
                        <li
                            key={level}
                            className="flex items-center gap-2 text-sm"
                        >
                            <UserLevelBadge level={level} />
                            {(
                                ((level * (level - 1)) / 2) *
                                achievementXp
                            ).toLocaleString('hr-HR')}{' '}
                            XP
                        </li>
                    ))}
                </ul>
                <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                    Postignuća se preuzimaju s primarnog računa korisnika. Kod
                    jednakog broja postignuća prednost ima ranije registrirani
                    korisnik.
                </p>
            </section>
            <CtaBand
                id="leaderboard-cta-title"
                title="Pridruži se vrtlarima."
                description="Složi svoju gredicu, skupljaj postignuća i penji se na ljestvici naše zajednice."
                secondaryAction={{
                    href: KnownPages.Achievements,
                    label: 'Istraži postignuća',
                }}
                className="mt-10"
            />
        </div>
    );
}
