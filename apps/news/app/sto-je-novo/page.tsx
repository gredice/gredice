import { Container } from '@gredice/ui/Container';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NewsArchiveNavigation } from '../../components/NewsArchiveNavigation';
import { NewsTagFilters } from '../../components/NewsTagFilters';
import { WeeklyChangelogArchive } from '../../components/WeeklyChangelogArchive';
import { WeeklyChangelogTimeline } from '../../components/WeeklyChangelogTimeline';
import {
    getDailyChangelogEntries,
    getPrimaryNewsTags,
    uniqueNewsValues,
} from '../../lib/news';
import { changelogArchiveMetadata } from '../../lib/newsArchiveMetadata';
import { buildChangelogWeeks } from '../../lib/weeklyChangelog';

export const revalidate = 86_400;
export const metadata: Metadata = changelogArchiveMetadata;

export default async function WhatsNewPage() {
    const entries = await getDailyChangelogEntries();
    const tags = uniqueNewsValues(entries, (item) => item.tags);
    const primaryTags = getPrimaryNewsTags(entries);
    const primaryTagKeys = new Set(
        primaryTags.map((value) => value.toLocaleLowerCase('hr-HR')),
    );
    const dropdownTags = tags.filter(
        (value) => !primaryTagKeys.has(value.toLocaleLowerCase('hr-HR')),
    );
    const weeks = buildChangelogWeeks(entries);

    return (
        <Container className="grid gap-8 py-10">
            <section className="grid gap-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Što je novo
                </p>
                <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl">
                    Promjene i nove mogućnosti
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground">
                    Tjedni sažeci nadogradnji, poboljšanja i novih značajki u
                    Gredicama, s poveznicama na svaku promjenu.
                </p>
            </section>
            <NewsArchiveNavigation active="changelog" />
            <Suspense
                fallback={
                    <div className="grid gap-8">
                        {tags.length > 0 ? (
                            <NewsTagFilters
                                dropdownTags={dropdownTags}
                                primaryTags={primaryTags}
                            />
                        ) : null}
                        <WeeklyChangelogTimeline weeks={weeks} />
                    </div>
                }
            >
                <WeeklyChangelogArchive
                    dropdownTags={dropdownTags}
                    primaryTags={primaryTags}
                    weeks={weeks}
                />
            </Suspense>
        </Container>
    );
}
