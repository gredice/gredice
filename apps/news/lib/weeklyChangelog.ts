const newsOrigin = 'https://www.gredice.com';
const newsBasePath = '/novosti/sto-je-novo';
const internalBasePath = '/sto-je-novo';
const croatiaTimeZone = 'Europe/Zagreb';

const croatiaDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: croatiaTimeZone,
    year: 'numeric',
});
const monthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
});
const dayOnlyFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    timeZone: 'UTC',
});
const dayMonthFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
});
const dayMonthYearFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
});

export type ChangelogWeekEntry = {
    excerpt?: string | null;
    id: number;
    metaImagePoiX?: number | null;
    metaImagePoiY?: number | null;
    metaImageUrl?: string | null;
    publishedAt: string;
    slug: string;
    tags: string[];
    title: string;
};

export type ChangelogWeek = {
    description: string;
    entries: ChangelogWeekEntry[];
    href: `/sto-je-novo/tjedan/${string}`;
    imageAlt: string;
    imagePath: `/novosti/sto-je-novo/tjedan/${string}/opengraph-image`;
    isCurrentWeek: boolean;
    latestPublishedAt: string;
    monthKey: string;
    monthLabel: string;
    publicPath: `/novosti/sto-je-novo/tjedan/${string}`;
    rangeLabel: string;
    tags: string[];
    title: string;
    weekKey: string;
};

type BuildChangelogWeeksOptions = {
    includeCurrentWeek?: boolean;
    now?: Date;
};

function paddedDatePart(value: number) {
    return value.toString().padStart(2, '0');
}

function utcDateKey(date: Date) {
    return [
        date.getUTCFullYear(),
        paddedDatePart(date.getUTCMonth() + 1),
        paddedDatePart(date.getUTCDate()),
    ].join('-');
}

function croatiaDateKey(date: Date) {
    const parts = new Map(
        croatiaDateKeyFormatter
            .formatToParts(date)
            .map((part) => [part.type, part.value]),
    );
    return [parts.get('year'), parts.get('month'), parts.get('day')].join('-');
}

function dateFromKey(dateKey: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateKey);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12));

    return utcDateKey(date) === dateKey ? date : null;
}

function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function weekKeyForDate(date: Date) {
    const localDate = dateFromKey(croatiaDateKey(date));
    if (!localDate) {
        return null;
    }

    const day = localDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return utcDateKey(addDays(localDate, mondayOffset));
}

function formatWeekRange(weekStart: Date, weekEnd: Date) {
    if (
        weekStart.getUTCFullYear() === weekEnd.getUTCFullYear() &&
        weekStart.getUTCMonth() === weekEnd.getUTCMonth()
    ) {
        return `${dayOnlyFormatter.format(weekStart)} – ${dayMonthYearFormatter.format(weekEnd)}`;
    }

    if (weekStart.getUTCFullYear() === weekEnd.getUTCFullYear()) {
        return `${dayMonthFormatter.format(weekStart)} – ${dayMonthYearFormatter.format(weekEnd)}`;
    }

    return `${dayMonthYearFormatter.format(weekStart)} – ${dayMonthYearFormatter.format(weekEnd)}`;
}

function uniqueTags(entries: ChangelogWeekEntry[]) {
    const tags = new Map<string, string>();

    for (const entry of entries) {
        for (const rawTag of entry.tags) {
            const tag = rawTag.trim();
            if (!tag || tag.toLocaleLowerCase('hr-HR') === 'novosti') {
                continue;
            }
            const key = tag.toLocaleLowerCase('hr-HR');
            if (!tags.has(key)) {
                tags.set(key, tag);
            }
        }
    }

    return Array.from(tags.values());
}

function changeCountLabel(count: number) {
    return count === 1
        ? '1 promjena'
        : count >= 2 && count <= 4
          ? `${count.toString()} promjene`
          : `${count.toString()} promjena`;
}

function highlightedTitles(entries: ChangelogWeekEntry[]) {
    return entries.slice(0, 2).map((entry) => `„${entry.title}”`);
}

function truncateDescription(value: string) {
    if (value.length <= 160) {
        return value;
    }

    return `${value.slice(0, 157).trimEnd()}…`;
}

function weekDescription(
    entries: ChangelogWeekEntry[],
    isCurrentWeek: boolean,
) {
    const titles = highlightedTitles(entries);
    const count = entries.length;

    if (isCurrentWeek) {
        if (count === 0) {
            return 'Tjedan još traje. Nove promjene i mogućnosti stižu uskoro.';
        }

        const highlights = titles.join(' i ');
        return truncateDescription(
            `Tjedan još traje. Već izdvajamo ${highlights}, a još novosti stiže.`,
        );
    }

    if (count === 1) {
        return truncateDescription(
            `Ovaj tjedan donio je promjenu ${titles[0]}.`,
        );
    }

    if (count === 2) {
        return truncateDescription(
            `Ovaj tjedan donio je ${titles.join(' i ')}.`,
        );
    }

    return truncateDescription(
        `Izdvajamo ${titles.join(', ')} i još ${changeCountLabel(count - 2)}.`,
    );
}

function latestPublishedAt(entries: ChangelogWeekEntry[], fallback: Date) {
    const latestTime = entries.reduce((latest, entry) => {
        const time = Date.parse(entry.publishedAt);
        return Number.isNaN(time) ? latest : Math.max(latest, time);
    }, 0);

    return latestTime > 0
        ? new Date(latestTime).toISOString()
        : fallback.toISOString();
}

function createChangelogWeek({
    entries,
    isCurrentWeek,
    now,
    weekKey,
}: {
    entries: ChangelogWeekEntry[];
    isCurrentWeek: boolean;
    now: Date;
    weekKey: string;
}): ChangelogWeek | null {
    const weekStart = dateFromKey(weekKey);
    if (!weekStart) {
        return null;
    }

    const weekEnd = addDays(weekStart, 6);
    const rangeLabel = formatWeekRange(weekStart, weekEnd);
    const publicPath = `${newsBasePath}/tjedan/${weekKey}` as const;
    const sortedEntries = entries.toSorted(
        (left, right) =>
            Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
            right.id - left.id,
    );

    return {
        description: weekDescription(sortedEntries, isCurrentWeek),
        entries: sortedEntries,
        href: `${internalBasePath}/tjedan/${weekKey}`,
        imageAlt: isCurrentWeek
            ? `Ovaj tjedan u Gredicama – još novosti stiže, ${rangeLabel}`
            : `Tjedni pregled Gredica, ${rangeLabel}`,
        imagePath: `${publicPath}/opengraph-image`,
        isCurrentWeek,
        latestPublishedAt: latestPublishedAt(sortedEntries, now),
        monthKey: weekKey.slice(0, 7),
        monthLabel: monthFormatter.format(weekStart),
        publicPath,
        rangeLabel,
        tags: uniqueTags(sortedEntries),
        title: isCurrentWeek
            ? 'Ovaj tjedan u Gredicama'
            : `Tjedan u Gredicama: ${rangeLabel}`,
        weekKey,
    };
}

export function isChangelogWeekKey(value: string) {
    const date = dateFromKey(value);
    return date?.getUTCDay() === 1;
}

export function changelogWeekCanonicalUrl(week: ChangelogWeek) {
    return `${newsOrigin}${week.publicPath}`;
}

export function changelogWeekImageUrl(week: ChangelogWeek) {
    return `${newsOrigin}${week.imagePath}`;
}

export function buildChangelogWeeks(
    entries: ChangelogWeekEntry[],
    {
        includeCurrentWeek = true,
        now = new Date(),
    }: BuildChangelogWeeksOptions = {},
) {
    const currentWeekKey = weekKeyForDate(now);
    const entriesByWeek = new Map<string, ChangelogWeekEntry[]>();

    for (const entry of entries) {
        const publishedAt = new Date(entry.publishedAt);
        if (Number.isNaN(publishedAt.getTime())) {
            continue;
        }

        const weekKey = weekKeyForDate(publishedAt);
        if (!weekKey) {
            continue;
        }

        const weekEntries = entriesByWeek.get(weekKey) ?? [];
        weekEntries.push(entry);
        entriesByWeek.set(weekKey, weekEntries);
    }

    if (
        includeCurrentWeek &&
        currentWeekKey &&
        !entriesByWeek.has(currentWeekKey)
    ) {
        entriesByWeek.set(currentWeekKey, []);
    }

    return Array.from(entriesByWeek.entries())
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([weekKey, weekEntries]) =>
            createChangelogWeek({
                entries: weekEntries,
                isCurrentWeek: weekKey === currentWeekKey,
                now,
                weekKey,
            }),
        )
        .filter((week): week is ChangelogWeek => week !== null);
}

export function findChangelogWeek(
    entries: ChangelogWeekEntry[],
    weekKey: string,
    options: BuildChangelogWeeksOptions = {},
) {
    if (!isChangelogWeekKey(weekKey)) {
        return null;
    }

    return (
        buildChangelogWeeks(entries, options).find(
            (week) => week.weekKey === weekKey,
        ) ?? null
    );
}
