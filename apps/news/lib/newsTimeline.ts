const monthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
});
const monthKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
});

type TimelineBlogEntry = {
    id: number;
    publishedAt: string;
};

type TimelineChangelogWeek = {
    latestPublishedAt: string;
    weekKey: string;
};

export type NewsTimelineItem<
    BlogEntry extends TimelineBlogEntry,
    ChangelogWeek extends TimelineChangelogWeek,
> =
    | {
          blog: BlogEntry;
          key: string;
          kind: 'blog';
          publishedAt: string;
      }
    | {
          key: string;
          kind: 'changelog';
          publishedAt: string;
          week: ChangelogWeek;
      };

export type NewsTimelineGroup<
    BlogEntry extends TimelineBlogEntry,
    ChangelogWeek extends TimelineChangelogWeek,
> = {
    items: NewsTimelineItem<BlogEntry, ChangelogWeek>[];
    monthKey: string;
    monthLabel: string;
};

function parsedTime(value: string) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
}

function monthDetails(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return { monthKey: 'unknown', monthLabel: 'Bez datuma' };
    }

    const parts = new Map(
        monthKeyFormatter
            .formatToParts(date)
            .map((part) => [part.type, part.value]),
    );

    return {
        monthKey: [parts.get('year'), parts.get('month')].join('-'),
        monthLabel: monthFormatter.format(date),
    };
}

export function buildNewsTimeline<
    BlogEntry extends TimelineBlogEntry,
    ChangelogWeek extends TimelineChangelogWeek,
>(blogPosts: BlogEntry[], changelogWeeks: ChangelogWeek[]) {
    const items: NewsTimelineItem<BlogEntry, ChangelogWeek>[] = [
        ...blogPosts.map((blog) => ({
            blog,
            key: `blog-${blog.id}`,
            kind: 'blog' as const,
            publishedAt: blog.publishedAt,
        })),
        ...changelogWeeks.map((week) => ({
            key: `changelog-${week.weekKey}`,
            kind: 'changelog' as const,
            publishedAt: week.latestPublishedAt,
            week,
        })),
    ].sort(
        (left, right) =>
            parsedTime(right.publishedAt) - parsedTime(left.publishedAt) ||
            left.key.localeCompare(right.key, 'hr-HR'),
    );
    const groups: NewsTimelineGroup<BlogEntry, ChangelogWeek>[] = [];
    const groupsByKey = new Map<
        string,
        NewsTimelineGroup<BlogEntry, ChangelogWeek>
    >();

    for (const item of items) {
        const { monthKey, monthLabel } = monthDetails(item.publishedAt);
        let group = groupsByKey.get(monthKey);

        if (!group) {
            group = { items: [], monthKey, monthLabel };
            groupsByKey.set(monthKey, group);
            groups.push(group);
        }

        group.items.push(item);
    }

    return groups;
}
