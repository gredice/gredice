import { Container } from '@gredice/ui/Container';
import { Timeline, TimelineEntry, TimelineGroup } from '@gredice/ui/Timeline';
import type { Route } from 'next';
import { EmptyNewsState } from '../../components/EmptyNewsState';
import { NewsCard } from '../../components/NewsCard';
import { NewsTagFilters } from '../../components/NewsTagFilters';
import {
    formatNewsDate,
    getChangelogEntries,
    getPrimaryNewsTags,
    uniqueNewsValues,
} from '../../lib/news';
import { getNewsArticleViewTransitionName } from '../../lib/viewTransitions';

export const dynamic = 'force-dynamic';

const monthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    year: 'numeric',
});
type ChangelogEntry = Awaited<ReturnType<typeof getChangelogEntries>>[number];

type ChangelogTimelineGroup = {
    entries: ChangelogEntry[];
    monthKey: string;
    monthLabel: string;
};

function paddedDatePart(value: number) {
    return value.toString().padStart(2, '0');
}

function getEntryDate(entry: ChangelogEntry) {
    if (!entry.publishedAt) {
        return null;
    }

    const date = new Date(entry.publishedAt);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getMonthKey(date: Date) {
    return [date.getFullYear(), paddedDatePart(date.getMonth() + 1)].join('-');
}

function groupEntriesByMonth(entries: ChangelogEntry[]) {
    const groups: ChangelogTimelineGroup[] = [];
    const groupsByKey = new Map<string, ChangelogTimelineGroup>();

    for (const entry of entries) {
        const date = getEntryDate(entry);
        const monthKey = date ? getMonthKey(date) : 'unknown';
        let group = groupsByKey.get(monthKey);

        if (!group) {
            group = {
                entries: [],
                monthKey,
                monthLabel: date ? monthFormatter.format(date) : 'Bez datuma',
            };
            groupsByKey.set(monthKey, group);
            groups.push(group);
        }

        group.entries.push(entry);
    }

    return groups;
}

function changelogEntryPath(slug: string): Route {
    return `/sto-je-novo/${slug}` as Route;
}

export default async function WhatsNewPage({
    searchParams,
}: {
    searchParams: Promise<{ tag?: string }>;
}) {
    const { tag } = await searchParams;
    const [allEntries, entries] = await Promise.all([
        getChangelogEntries(),
        tag ? getChangelogEntries({ tag }) : getChangelogEntries(),
    ]);
    const tags = uniqueNewsValues(allEntries, (item) => item.tags);
    const primaryTags = getPrimaryNewsTags(allEntries);
    const primaryTagKeys = new Set(
        primaryTags.map((value) => value.toLocaleLowerCase('hr-HR')),
    );
    const dropdownTags = tags.filter(
        (value) => !primaryTagKeys.has(value.toLocaleLowerCase('hr-HR')),
    );
    const timelineGroups = groupEntriesByMonth(entries);
    const totalEntries = entries.length;
    let entryIndex = 0;

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
                    Kronološki pregled nadogradnji, poboljšanja i novih značajki
                    u Gredicama.
                </p>
            </section>
            {tags.length > 0 ? (
                <NewsTagFilters
                    activeTag={tag}
                    dropdownTags={dropdownTags}
                    primaryTags={primaryTags}
                />
            ) : null}
            {entries.length > 0 ? (
                <Timeline>
                    {timelineGroups.map((group, groupIndex) => (
                        <TimelineGroup
                            hasItems={group.entries.length > 0}
                            isFirst={groupIndex === 0}
                            key={group.monthKey}
                            label={group.monthLabel}
                        >
                            {group.entries.map((entry) => {
                                const currentEntryIndex = entryIndex;
                                const dateLabel = entry.publishedAt
                                    ? formatNewsDate(entry.publishedAt)
                                    : null;
                                entryIndex += 1;

                                return (
                                    <TimelineEntry
                                        index={currentEntryIndex}
                                        isLast={
                                            currentEntryIndex ===
                                            totalEntries - 1
                                        }
                                        key={entry.id}
                                        label={dateLabel ?? 'Bez datuma'}
                                    >
                                        <NewsCard
                                            entry={entry}
                                            href={changelogEntryPath(
                                                entry.slug,
                                            )}
                                            kind="changelog"
                                            showDate={false}
                                            showKindLabel={false}
                                            viewTransitionName={getNewsArticleViewTransitionName(
                                                'changelog',
                                                entry.slug,
                                            )}
                                        />
                                    </TimelineEntry>
                                );
                            })}
                        </TimelineGroup>
                    ))}
                </Timeline>
            ) : (
                <EmptyNewsState title="Još nema zapisa">
                    Trenutačno nema objavljenih novosti.
                </EmptyNewsState>
            )}
        </Container>
    );
}
