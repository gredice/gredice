import { GameJournalIcon } from '@gredice/ui/GameIcons';
import { Link } from '@gredice/ui/Link';
import { describeAcceptedSuggestionCount } from '../../../components/community-edits/communityContributorsText';
import { formatGardenDate } from '../../vrtovi/publicGardenFormatting';
import type { PublicProfileContributions as PublicProfileContributionsData } from '../communityContributions';

/** Public pages this gardener helped write through accepted suggestions. */
export function PublicProfileContributions({
    contributions,
}: {
    contributions: PublicProfileContributionsData | null | undefined;
}) {
    if (!contributions || contributions.pages.length === 0) {
        return null;
    }

    return (
        <section aria-labelledby="profile-contributions-heading">
            <div className="mb-5">
                <h2
                    id="profile-contributions-heading"
                    className="text-2xl font-semibold"
                >
                    Poboljšane stranice
                </h2>
                <p className="mt-1 text-muted-foreground">
                    {describeAcceptedSuggestionCount(
                        contributions.acceptedCount,
                    )}{' '}
                    za javne stranice. Ovo su najnovije.
                </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {contributions.pages.map((page) => (
                    <li
                        key={`${page.publicPath}-${page.appliedAt}`}
                        className="relative flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary hover:bg-muted/60 motion-reduce:transition-none"
                    >
                        <GameJournalIcon
                            aria-hidden
                            className="size-10 shrink-0"
                        />
                        <div className="min-w-0">
                            <h3 className="font-semibold leading-snug">
                                <Link
                                    href={page.publicPath}
                                    className="break-words outline-hidden after:absolute after:inset-0 after:rounded-2xl"
                                >
                                    {page.title}
                                </Link>
                            </h3>
                            {page.context ? (
                                <p className="text-sm text-muted-foreground">
                                    {page.context}
                                </p>
                            ) : null}
                            <p className="mt-1 text-sm text-muted-foreground">
                                Objavljeno{' '}
                                <time dateTime={page.appliedAt}>
                                    {formatGardenDate(page.appliedAt)}
                                </time>
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
