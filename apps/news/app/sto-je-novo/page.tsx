import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
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
        <Container className="grid gap-8 pt-8 pb-10 md:pt-12">
            <PageHeader
                tagline="Što je novo"
                header="Promjene i nove mogućnosti"
                subHeader="Tjedni sažeci nadogradnji, poboljšanja i novih značajki u Gredicama, s poveznicama na svaku promjenu."
            />
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
