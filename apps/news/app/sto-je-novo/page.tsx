import { Container } from '@gredice/ui/Container';
import { Timeline, TimelineEntry, TimelineGroup } from '@gredice/ui/Timeline';
import type { Route } from 'next';
import { EmptyNewsState } from '../../components/EmptyNewsState';
import { NewsArchiveNavigation } from '../../components/NewsArchiveNavigation';
import { NewsCard } from '../../components/NewsCard';
import { NewsTagFilters } from '../../components/NewsTagFilters';
import {
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
const dayOnlyFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
});
const dayMonthFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
});
const dayMonthYearFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});
type ChangelogEntry = Awaited<ReturnType<typeof getChangelogEntries>>[number];

type ChangelogTimelineGroup = {
    monthKey: string;
    monthLabel: string;
    weeks: ChangelogTimelineWeek[];
};

type ChangelogTimelineWeek = {
    entries: ChangelogEntry[];
    weekKey: string;
    weekLabel: string;
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

function getDayKey(date: Date) {
    return [
        date.getFullYear(),
        paddedDatePart(date.getMonth() + 1),
        paddedDatePart(date.getDate()),
    ].join('-');
}

function getWeekStart(date: Date) {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;

    weekStart.setDate(weekStart.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    return weekStart;
}

function getWeekEnd(weekStart: Date) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return weekEnd;
}

function formatWeekRange(weekStart: Date, weekEnd: Date) {
    if (
        weekStart.getFullYear() === weekEnd.getFullYear() &&
        weekStart.getMonth() === weekEnd.getMonth()
    ) {
        return `${dayOnlyFormatter.format(weekStart)} - ${dayMonthYearFormatter.format(weekEnd)}`;
    }

    if (weekStart.getFullYear() === weekEnd.getFullYear()) {
        return `${dayMonthFormatter.format(weekStart)} - ${dayMonthYearFormatter.format(weekEnd)}`;
    }

    return `${dayMonthYearFormatter.format(weekStart)} - ${dayMonthYearFormatter.format(weekEnd)}`;
}

function groupEntriesByWeek(entries: ChangelogEntry[]) {
    const groups: ChangelogTimelineGroup[] = [];
    const groupsByKey = new Map<string, ChangelogTimelineGroup>();
    const weeksByKey = new Map<string, ChangelogTimelineWeek>();

    for (const entry of entries) {
        const date = getEntryDate(entry);
        const weekStart = date ? getWeekStart(date) : null;
        const weekEnd = weekStart ? getWeekEnd(weekStart) : null;
        const monthKey = weekStart ? getMonthKey(weekStart) : 'unknown';
        const weekKey = weekStart ? getDayKey(weekStart) : 'unknown';
        let group = groupsByKey.get(monthKey);

        if (!group) {
            group = {
                monthKey,
                monthLabel: weekStart
                    ? monthFormatter.format(weekStart)
                    : 'Bez datuma',
                weeks: [],
            };
            groupsByKey.set(monthKey, group);
            groups.push(group);
        }

        let week = weeksByKey.get(weekKey);

        if (!week) {
            week = {
                entries: [],
                weekKey,
                weekLabel:
                    weekStart && weekEnd
                        ? formatWeekRange(weekStart, weekEnd)
                        : 'Bez datuma',
            };
            weeksByKey.set(weekKey, week);
            group.weeks.push(week);
        }

        week.entries.push(entry);
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
    const timelineGroups = groupEntriesByWeek(entries);
    const totalWeeks = timelineGroups.reduce(
        (total, group) => total + group.weeks.length,
        0,
    );
    let weekIndex = 0;

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
            <NewsArchiveNavigation active="changelog" />
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
                            hasItems={group.weeks.length > 0}
                            isFirst={groupIndex === 0}
                            key={group.monthKey}
                            label={group.monthLabel}
                        >
                            {group.weeks.map((week) => {
                                const currentWeekIndex = weekIndex;
                                weekIndex += 1;

                                return (
                                    <TimelineEntry
                                        index={currentWeekIndex}
                                        isLast={
                                            currentWeekIndex === totalWeeks - 1
                                        }
                                        key={week.weekKey}
                                        label={week.weekLabel}
                                    >
                                        <div className="space-y-4">
                                            {week.entries.map((entry) => (
                                                <NewsCard
                                                    entry={entry}
                                                    href={changelogEntryPath(
                                                        entry.slug,
                                                    )}
                                                    key={entry.id}
                                                    kind="changelog"
                                                    showKindLabel={false}
                                                    viewTransitionName={getNewsArticleViewTransitionName(
                                                        'changelog',
                                                        entry.slug,
                                                    )}
                                                />
                                            ))}
                                        </div>
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
