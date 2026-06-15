import { Timeline, TimelineEntry, TimelineGroup } from '@gredice/ui/Timeline';
import Link from 'next/link';
import { EmptyNewsState } from '../../components/EmptyNewsState';
import {
    formatNewsDate,
    getChangelogEntries,
    uniqueNewsValues,
} from '../../lib/news';

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
    const timelineGroups = groupEntriesByMonth(entries);
    const totalEntries = entries.length;
    let entryIndex = 0;

    return (
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
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
                <div className="flex flex-wrap gap-2">
                    <Link
                        className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                            tag
                                ? 'bg-background text-muted-foreground'
                                : 'bg-primary text-primary-foreground'
                        }`}
                        href="/sto-je-novo"
                    >
                        Sve
                    </Link>
                    {tags.map((value) => (
                        <Link
                            key={value}
                            className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                                tag === value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background text-muted-foreground hover:text-foreground'
                            }`}
                            href={`/sto-je-novo?tag=${encodeURIComponent(value)}`}
                        >
                            {value}
                        </Link>
                    ))}
                </div>
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
                                        <Link
                                            className={`grid overflow-hidden rounded-md border bg-card shadow-xs transition-colors hover:bg-muted/20 ${
                                                entry.metaImageUrl
                                                    ? 'md:grid-cols-[minmax(0,1fr)_220px]'
                                                    : ''
                                            }`}
                                            href={`/sto-je-novo/${entry.slug}`}
                                        >
                                            <div className="grid gap-3 p-5">
                                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                                    {entry.tags.map(
                                                        (entryTag) => (
                                                            <span
                                                                key={entryTag}
                                                            >
                                                                {entryTag}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                                <h2 className="text-xl font-bold leading-tight">
                                                    {entry.title}
                                                </h2>
                                                {entry.excerpt ? (
                                                    <p className="text-sm leading-6 text-muted-foreground">
                                                        {entry.excerpt}
                                                    </p>
                                                ) : null}
                                            </div>
                                            {entry.metaImageUrl ? (
                                                <div className="min-h-48 border-t bg-muted/30 md:border-l md:border-t-0">
                                                    {/* biome-ignore lint/performance/noImgElement: CMS images are remote author content. */}
                                                    <img
                                                        alt=""
                                                        className="h-full min-h-48 w-full object-cover"
                                                        src={entry.metaImageUrl}
                                                    />
                                                </div>
                                            ) : null}
                                        </Link>
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
        </div>
    );
}
