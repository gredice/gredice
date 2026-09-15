import {
    achievementXp,
    getAchievementProgress,
} from '@gredice/js/achievements';
import { GameTrophyIcon } from '@gredice/ui/GameIcons';
import { Link } from '@gredice/ui/Link';
import { publicUserProfileHref } from '@gredice/ui/PublicChrome';
import { UserAvatar, UserLevelBadge } from '@gredice/ui/UserAvatar';
import { KnownPages } from '../../src/KnownPages';
import type { getUserLeaderboard } from './leaderboard';

export function UserLeaderboard({
    items,
}: Awaited<ReturnType<typeof getUserLeaderboard>>) {
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
                <div className="mb-4 flex items-end justify-between gap-4">
                    <h2
                        id="leaderboard-title"
                        className="text-xl font-semibold"
                    >
                        Top 10 vrtlara
                    </h2>
                    <span className="text-sm text-muted-foreground">
                        Ukupni poredak
                    </span>
                </div>
                {items.length ? (
                    <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
                        {items.map((user, index) => {
                            const { level, xp } = getAchievementProgress(
                                user.achievementCount,
                            );
                            return (
                                <li key={user.publicId}>
                                    <Link
                                        href={publicUserProfileHref(
                                            user.publicId,
                                        )}
                                        className={`group flex items-center gap-3 px-3 py-5 transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:gap-5 sm:px-6 ${index === 0 ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
                                    >
                                        <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
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
                                                {xp.toLocaleString('hr-HR')} XP
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
                <Link
                    href={KnownPages.GardenApp}
                    className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                    Pridruži se vrtlarima
                </Link>
            </section>
        </div>
    );
}
