import { croatianPlural } from '@gredice/js/i18n';
import { Link } from '@gredice/ui/Link';
import { publicUserProfileHref } from '@gredice/ui/PublicChrome';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { KnownPages } from '../../src/KnownPages';
import type { LeaderboardEditor } from './communityContributions';

/** Gardeners with the most accepted content suggestions. */
export function LeaderboardEditors({
    editors,
}: {
    editors: readonly LeaderboardEditor[];
}) {
    if (editors.length === 0) {
        return null;
    }

    return (
        <section
            aria-labelledby="leaderboard-editors-title"
            className="mt-10 border-t pt-8"
        >
            <h2
                id="leaderboard-editors-title"
                className="text-xl font-semibold"
            >
                Urednici
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Vrtlari s najviše prihvaćenih prijedloga za stranice o biljkama,
                radnjama, bolestima i štetnicima. Svaku takvu stranicu možeš
                poboljšati i ti: otvori je i odaberi „Predloži izmjenu”.
            </p>
            <ul
                data-leaderboard-editors=""
                className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card"
            >
                {editors.map((editor) => (
                    <li key={editor.publicId}>
                        <Link
                            href={publicUserProfileHref(editor.publicId)}
                            className="group flex items-center gap-3 px-3 py-4 transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none sm:gap-5 sm:px-6"
                        >
                            <UserAvatar
                                avatarUrl={editor.avatarUrl}
                                displayName={editor.displayName}
                                achievementCount={editor.achievementCount}
                            />
                            <span className="block min-w-0 flex-1 break-words font-semibold group-hover:underline">
                                {editor.displayName}
                            </span>
                            <span className="shrink-0 text-right">
                                <span className="block text-xl font-semibold tabular-nums">
                                    {editor.acceptedEditCount.toLocaleString(
                                        'hr-HR',
                                    )}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {croatianPlural(editor.acceptedEditCount, {
                                        one: 'prihvaćen prijedlog',
                                        few: 'prihvaćena prijedloga',
                                        many: 'prihvaćenih prijedloga',
                                    })}
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
                Već predlažeš izmjene?{' '}
                <Link
                    href={KnownPages.MySuggestions}
                    className="font-semibold underline underline-offset-4"
                >
                    Prati svoje prijedloge
                </Link>
                .
            </p>
        </section>
    );
}
