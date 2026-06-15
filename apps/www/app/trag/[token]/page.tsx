import { plantFieldStatusEmoji } from '@gredice/js/plants';
import {
    getPublicHarvestTraceByToken,
    type PublicHarvestTrace,
    type PublicHarvestTraceLocation,
    type PublicHarvestTraceStatusDate,
    type PublicHarvestTraceTimelineImage,
    type PublicHarvestTraceTimelineItem,
    recordHarvestTraceScan,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import {
    Calendar,
    Camera,
    Droplets,
    Hammer,
    Leaf,
    LinkOff,
    Sprout,
    Upload,
} from '@gredice/ui/icons';
import { OperationCategoryIcon } from '@gredice/ui/OperationImage';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Timeline, TimelineEntry, TimelineGroup } from '@gredice/ui/Timeline';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    PlantMonthCalendar,
    type PlantMonthCalendarRow,
} from '../../biljke/PlantMonthCalendar';
import { HarvestTraceStatusEvent } from './HarvestTraceStatusEvent';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Trag berbe',
    description: 'Javni trag berbe Gredice.',
    robots: {
        index: false,
        follow: false,
    },
};

const dayFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
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

const shortDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
});

const monthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    year: 'numeric',
});

const croatianPluralRules = new Intl.PluralRules('hr-HR');

function getTraceDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function paddedDatePart(value: number) {
    return value.toString().padStart(2, '0');
}

function getDayKey(date: Date) {
    return [
        date.getFullYear(),
        paddedDatePart(date.getMonth() + 1),
        paddedDatePart(date.getDate()),
    ].join('-');
}

function getMonthKey(date: Date) {
    return [date.getFullYear(), paddedDatePart(date.getMonth() + 1)].join('-');
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

function formatTraceNumber(value: number) {
    return new Intl.NumberFormat('hr-HR', {
        maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    }).format(value);
}

function formatLiters(value: number) {
    return `${formatTraceNumber(value)} L`;
}

function countLabel(count: number, singular: string, plural: string) {
    return croatianPluralRules.select(count) === 'one'
        ? `${count} ${singular}`
        : `${count} ${plural}`;
}

function operationCountLabel(count: number) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    if (count === 1) {
        return `${count} radnja`;
    }

    if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
    ) {
        return `${count} radnje`;
    }

    return `${count} radnji`;
}

type TimelineDayGroup = {
    dateKey: string;
    dateLabel: string;
    items: PublicHarvestTraceTimelineItem[];
};

type TimelineWeekGroup = {
    weekKey: string;
    weekLabel: string;
    monthKey: string;
    monthLabel: string;
    days: TimelineDayGroup[];
    images: PublicHarvestTraceTimelineImage[];
};

type TimelineMonthGroup = {
    monthKey: string;
    monthLabel: string;
    weeks: TimelineWeekGroup[];
};

function addImagesToWeek(
    week: TimelineWeekGroup,
    images: PublicHarvestTraceTimelineImage[] | undefined,
) {
    if (!images) {
        return;
    }

    const existingUrls = new Set(week.images.map((image) => image.url));

    for (const image of images) {
        if (!image.url || existingUrls.has(image.url)) {
            continue;
        }

        week.images.push(image);
        existingUrls.add(image.url);
    }
}

function groupTimelineByWeek(
    timeline: PublicHarvestTraceTimelineItem[],
): TimelineMonthGroup[] {
    const monthGroups: TimelineMonthGroup[] = [];
    const monthGroupsByKey = new Map<string, TimelineMonthGroup>();
    const weekGroupsByKey = new Map<string, TimelineWeekGroup>();

    for (const item of timeline) {
        const date = getTraceDate(item.occurredAt);
        const weekStart = date ? getWeekStart(date) : null;
        const weekEnd = weekStart ? getWeekEnd(weekStart) : null;
        const monthKey = weekStart ? getMonthKey(weekStart) : 'unknown';
        const weekKey = weekStart ? getDayKey(weekStart) : 'unknown';
        const dateKey = date ? getDayKey(date) : 'unknown';
        let monthGroup = monthGroupsByKey.get(monthKey);

        if (!monthGroup) {
            monthGroup = {
                monthKey,
                monthLabel: weekStart
                    ? monthFormatter.format(weekStart)
                    : 'Bez datuma',
                weeks: [],
            };
            monthGroupsByKey.set(monthKey, monthGroup);
            monthGroups.push(monthGroup);
        }

        let weekGroup = weekGroupsByKey.get(weekKey);
        if (!weekGroup) {
            weekGroup = {
                weekKey,
                weekLabel:
                    weekStart && weekEnd
                        ? formatWeekRange(weekStart, weekEnd)
                        : 'Bez datuma',
                monthKey,
                monthLabel: monthGroup.monthLabel,
                days: [],
                images: [],
            };
            weekGroupsByKey.set(weekKey, weekGroup);
            monthGroup.weeks.push(weekGroup);
        }

        let dayGroup = weekGroup.days.find(
            (group) => group.dateKey === dateKey,
        );
        if (!dayGroup) {
            dayGroup = {
                dateKey,
                dateLabel: date ? dayFormatter.format(date) : 'Bez datuma',
                items: [],
            };
            weekGroup.days.push(dayGroup);
        }

        dayGroup.items.push(item);
        addImagesToWeek(weekGroup, item.images);
    }

    for (const monthGroup of monthGroups) {
        for (const weekGroup of monthGroup.weeks) {
            for (const dayGroup of weekGroup.days) {
                dayGroup.items.sort(compareTimelineDayItems);
            }
        }
    }

    return monthGroups;
}

function isPlantStatusTimelineItem(item: PublicHarvestTraceTimelineItem) {
    return item.kind === 'lifecycle' && Boolean(item.plantStatus);
}

function compareTimelineDayItems(
    left: PublicHarvestTraceTimelineItem,
    right: PublicHarvestTraceTimelineItem,
) {
    const leftIsStatus = isPlantStatusTimelineItem(left);
    const rightIsStatus = isPlantStatusTimelineItem(right);

    if (leftIsStatus !== rightIsStatus) {
        return leftIsStatus ? -1 : 1;
    }

    const timeDifference =
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime();

    if (timeDifference !== 0) {
        return timeDifference;
    }

    return left.title.localeCompare(right.title, 'hr');
}

async function recordScan(token: string) {
    try {
        const headerStore = await headers();
        await recordHarvestTraceScan(token, {
            userAgent: headerStore.get('user-agent'),
        });
    } catch {
        // Scan analytics are best-effort and should never block the public trace.
    }
}

async function loadTrace(token: string) {
    try {
        return await getPublicHarvestTraceByToken(token);
    } catch {
        return null;
    }
}

function InvalidTraceState() {
    return (
        <Stack spacing={6} className="mx-auto max-w-2xl py-8 sm:py-12">
            <Card className="p-6 sm:p-8">
                <Stack spacing={5} alignItems="center" className="text-center">
                    <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <LinkOff className="size-7" />
                    </span>
                    <Stack spacing={2}>
                        <Typography level="h1">
                            Trag berbe nije dostupan
                        </Typography>
                        <Typography className="text-muted-foreground">
                            Poveznica nije važeća, istekla je ili opozvana.
                            Provjeri etiketu ili nam se javi ako trebaš pomoć.
                        </Typography>
                    </Stack>
                    <Button href="/" variant="solid">
                        Na početnu
                    </Button>
                </Stack>
            </Card>
        </Stack>
    );
}

function TraceHero({ trace }: { trace: PublicHarvestTrace }) {
    return (
        <section className="rounded-lg bg-background">
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,16rem)_minmax(0,1fr)] sm:gap-0">
                <div className="relative mx-auto size-36 sm:col-start-2 sm:size-56 md:size-64">
                    {trace.plantSortImageUrl ? (
                        <Image
                            src={trace.plantSortImageUrl}
                            alt={trace.plantSortImageAlt ?? trace.plantSortName}
                            fill
                            sizes="(min-width: 768px) 16rem, (min-width: 640px) 14rem, 9rem"
                            className="object-contain"
                            priority
                        />
                    ) : (
                        <div className="flex size-full items-center justify-center">
                            <Sprout className="size-16 text-primary/70 sm:size-24" />
                        </div>
                    )}
                </div>

                <Stack
                    spacing={5}
                    className="min-w-0 text-center sm:col-start-3 sm:pl-7 sm:text-left"
                >
                    <Stack spacing={2}>
                        <Typography
                            level="body2"
                            semiBold
                            className="text-primary uppercase tracking-wide"
                        >
                            Trag berbe
                        </Typography>
                        <Typography
                            level="h1"
                            className="break-words text-3xl sm:text-4xl"
                        >
                            {trace.title}
                        </Typography>
                        <Typography className="text-muted-foreground">
                            {trace.subtitle}
                        </Typography>
                    </Stack>
                </Stack>
            </div>
        </section>
    );
}

function StatisticCard({
    children,
    className,
    icon,
    label,
    value,
}: {
    children?: ReactNode;
    className?: string;
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <Card className={cx('bg-card p-3', className)}>
            <Stack spacing={2}>
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {icon}
                    </span>
                    <Stack spacing={1} className="min-w-0">
                        <Typography
                            level="body2"
                            semiBold
                            className="text-muted-foreground"
                        >
                            {label}
                        </Typography>
                        <Typography level="h3" className="text-xl">
                            {value}
                        </Typography>
                    </Stack>
                </div>
                {children}
            </Stack>
        </Card>
    );
}

function StatisticsImageGallery({
    images,
}: {
    images: PublicHarvestTraceTimelineImage[];
}) {
    if (images.length === 0) {
        return null;
    }

    return (
        <ImageGallery
            images={images.map((image, index) => ({
                src: image.url,
                alt: image.alt ?? `Fotografija berbe ${index + 1}`,
            }))}
            previewVariant="stacked"
            previewLimitBeforeStack={3}
            previewWidth={76}
            previewHeight={54}
        />
    );
}

function statusRangeClassName(status: string) {
    if (status === 'sowed' || status === 'pendingVerification') {
        return 'bg-amber-900 dark:bg-amber-400';
    }

    if (status === 'sprouted') {
        return 'bg-emerald-500 dark:bg-emerald-400';
    }

    if (status === 'firstFlowers') {
        return 'bg-pink-400 dark:bg-pink-300';
    }

    if (status === 'firstFruitSet') {
        return 'bg-red-500 dark:bg-red-400';
    }

    if (status === 'ready') {
        return 'bg-orange-400 dark:bg-orange-300';
    }

    if (status === 'harvested') {
        return 'bg-lime-600 dark:bg-lime-400';
    }

    if (status === 'removed') {
        return 'bg-stone-500 dark:bg-stone-300';
    }

    if (status === 'notSprouted' || status === 'died') {
        return 'bg-red-700 dark:bg-red-400';
    }

    return 'bg-muted-foreground';
}

function getTraceCalendarBoundary(date: Date, edge: 'start' | 'end') {
    const daysInMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
    ).getDate();
    const dayProgress =
        edge === 'start'
            ? (date.getDate() - 1) / daysInMonth
            : date.getDate() / daysInMonth;

    return date.getMonth() + 1 + Math.min(0.99, Math.max(0, dayProgress));
}

function TraceStatusCalendar({
    dates,
}: {
    dates: PublicHarvestTraceStatusDate[];
}) {
    if (dates.length === 0) {
        return null;
    }

    const parsedRows = dates
        .map((date) => ({
            ...date,
            parsedDate: getTraceDate(date.occurredAt),
        }))
        .filter(
            (
                date,
            ): date is PublicHarvestTraceStatusDate & {
                parsedDate: Date;
            } => date.parsedDate !== null,
        )
        .sort(
            (left, right) =>
                left.parsedDate.getTime() - right.parsedDate.getTime(),
        );

    if (parsedRows.length === 0) {
        return null;
    }

    const rows: PlantMonthCalendarRow[] = parsedRows.map((row, index) => {
        const nextRow = parsedRows[index + 1];
        const endDate =
            nextRow && nextRow.parsedDate.getTime() >= row.parsedDate.getTime()
                ? nextRow.parsedDate
                : row.parsedDate;

        return {
            color: statusRangeClassName(row.status),
            key: `${row.status}-${row.label}-${row.occurredAt}`,
            label: row.label,
            leading: (
                <span className="shrink-0 text-sm leading-none">
                    {plantFieldStatusEmoji(row.status)}
                </span>
            ),
            ranges: [
                {
                    end: getTraceCalendarBoundary(endDate, 'end'),
                    start: getTraceCalendarBoundary(row.parsedDate, 'start'),
                },
            ],
            title: row.label,
            trailing: (
                <Typography
                    level="body3"
                    className="shrink-0 text-muted-foreground"
                >
                    {shortDateFormatter.format(row.parsedDate)}
                </Typography>
            ),
        };
    });

    return (
        <Card className="self-start overflow-hidden bg-card p-0">
            <PlantMonthCalendar
                rows={rows}
                showToday={false}
                gridClassName="relative grid min-w-[42rem] grid-cols-[clamp(170px,34%,220px)_repeat(12,minmax(0,1fr))] rounded-lg text-sm"
                labelCellClassName="mx-2 min-w-0 overflow-hidden"
            />
        </Card>
    );
}

function OtherOperationNames({
    names,
    totalCount,
}: {
    names: string[];
    totalCount: number;
}) {
    if (names.length === 0) {
        return (
            <Typography level="body2" className="text-muted-foreground">
                Bez zalijevanja i fotografiranja.
            </Typography>
        );
    }

    const remainingCount = Math.max(0, totalCount - names.length);

    return (
        <ul className="space-y-1">
            {names.map((name) => (
                <li key={name} className="flex min-w-0 items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <Typography level="body2" className="min-w-0 truncate">
                        {name}
                    </Typography>
                </li>
            ))}
            {remainingCount > 0 ? (
                <li className="flex min-w-0 items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                    <Typography level="body2" className="text-muted-foreground">
                        + još {operationCountLabel(remainingCount)}
                    </Typography>
                </li>
            ) : null}
        </ul>
    );
}

function TraceStatistics({ trace }: { trace: PublicHarvestTrace }) {
    const { statistics } = trace;
    const hasWatering = statistics.wateringCount > 0;
    const hasImages = statistics.imageCount > 0;
    const hasOtherOperations = statistics.otherOperationCount > 0;
    const hasStatusDates = statistics.statusDates.length > 0;

    if (!hasWatering && !hasImages && !hasOtherOperations && !hasStatusDates) {
        return null;
    }

    const wateringCard = hasWatering ? (
        <StatisticCard
            icon={<Droplets className="size-4" />}
            label="Zalijevanje"
            value={
                statistics.plantWaterLiters !== undefined
                    ? formatLiters(statistics.plantWaterLiters)
                    : countLabel(
                          statistics.wateringCount,
                          'zalijevanje',
                          'zalijevanja',
                      )
            }
        >
            <Typography level="body2" className="text-muted-foreground">
                {countLabel(
                    statistics.wateringCount,
                    'zalijevanje',
                    'zalijevanja',
                )}
                {statistics.totalWaterLiters !== undefined
                    ? ` · ${formatLiters(statistics.totalWaterLiters)} za gredicu`
                    : null}
            </Typography>
        </StatisticCard>
    ) : null;

    const imagesCard = hasImages ? (
        <Card className="bg-card p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Camera className="size-4" />
                    </span>
                    <Stack spacing={1} className="min-w-0">
                        <Typography
                            level="body2"
                            semiBold
                            className="text-muted-foreground"
                        >
                            Fotografije
                        </Typography>
                        <Typography level="h3" className="text-xl">
                            {countLabel(
                                statistics.imageCount,
                                'fotografija',
                                'fotografija',
                            )}
                        </Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Od sadnje do berbe.
                        </Typography>
                    </Stack>
                </div>
                <StatisticsImageGallery images={statistics.images} />
            </div>
        </Card>
    ) : null;

    const otherOperationsCard = hasOtherOperations ? (
        <StatisticCard
            icon={<Hammer className="size-4" />}
            label="Ostale radnje"
            value={operationCountLabel(statistics.otherOperationCount)}
        >
            <OtherOperationNames
                names={statistics.otherOperationNames}
                totalCount={statistics.otherOperationCount}
            />
        </StatisticCard>
    ) : null;
    const hasLeftColumnCards = hasWatering || hasOtherOperations;

    return (
        <section className="rounded-lg bg-background py-5 sm:py-7">
            <Stack spacing={4}>
                <Stack spacing={1} alignItems="center" className="text-center">
                    <Typography level="h2" className="text-2xl sm:text-3xl">
                        Ukratko
                    </Typography>
                    <Typography className="text-muted-foreground">
                        Sažetak zabilježenih radnji i promjena kroz uzgoj.
                    </Typography>
                </Stack>

                <div
                    className={cx(
                        'grid items-start gap-3',
                        hasStatusDates && hasLeftColumnCards
                            ? 'lg:grid-cols-[minmax(17rem,0.82fr)_minmax(0,1.18fr)]'
                            : !hasStatusDates
                              ? 'sm:grid-cols-2 lg:grid-cols-3'
                              : null,
                    )}
                >
                    {hasStatusDates ? (
                        <>
                            {hasLeftColumnCards ? (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                    {wateringCard}
                                    {otherOperationsCard}
                                </div>
                            ) : null}
                            <div className="grid gap-3">
                                <TraceStatusCalendar
                                    dates={statistics.statusDates}
                                />
                                {imagesCard}
                            </div>
                        </>
                    ) : (
                        <>
                            {wateringCard}
                            {imagesCard}
                            {otherOperationsCard}
                        </>
                    )}
                </div>
            </Stack>
        </section>
    );
}

function TimelineVisual({ item }: { item: PublicHarvestTraceTimelineItem }) {
    const iconClassName = 'size-4 text-primary';

    if (item.imageUrl) {
        return (
            <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <Image
                    src={item.imageUrl}
                    alt={item.imageAlt ?? item.title}
                    fill
                    sizes="40px"
                    className="object-contain p-1"
                />
            </span>
        );
    }

    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg">
            {item.kind === 'operation' ? (
                <OperationCategoryIcon
                    categoryName={item.operationCategoryName}
                    className={iconClassName}
                />
            ) : item.tone === 'seed' ? (
                <Sprout className={iconClassName} />
            ) : item.tone === 'harvest' ? (
                <Upload className={iconClassName} />
            ) : item.tone === 'ready' ? (
                <Calendar className={iconClassName} />
            ) : (
                <Leaf className={iconClassName} />
            )}
        </span>
    );
}

function TimelineEvent({ item }: { item: PublicHarvestTraceTimelineItem }) {
    const isStatusItem = isPlantStatusTimelineItem(item);
    const operationCount =
        item.kind === 'operation' ? item.operationCount : undefined;

    if (isStatusItem && item.plantStatus) {
        return (
            <HarvestTraceStatusEvent
                item={{
                    description: item.description,
                    location: item.location,
                    plantStatus: item.plantStatus,
                    title: item.title,
                }}
            />
        );
    }

    return (
        <article className="flex min-w-0 gap-3 py-1">
            <TimelineVisual item={item} />
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <Stack spacing={1} className="min-w-0">
                    <Typography semiBold className="break-words leading-snug">
                        {item.title}
                    </Typography>
                    {item.description ? (
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            {item.description}
                        </Typography>
                    ) : null}
                    {item.location ? (
                        <TraceTimelineLocation location={item.location} />
                    ) : null}
                </Stack>
                {operationCount && operationCount > 1 ? (
                    <Typography
                        component="span"
                        level="body2"
                        semiBold
                        className="mt-0.5 inline-flex min-w-8 shrink-0 justify-center rounded-md bg-muted px-2 py-0.5 text-muted-foreground"
                        aria-label={`${operationCount} radnji`}
                    >
                        x{operationCount}
                    </Typography>
                ) : null}
            </div>
        </article>
    );
}

function TraceTimelineLocation({
    location,
}: {
    location: PublicHarvestTraceLocation;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <RaisedBedLabel
                physicalId={location.raisedBedPhysicalId}
                name={location.raisedBedName}
                size="compact"
            />
            {location.fieldLabel ? (
                <Typography level="body2" className="text-muted-foreground">
                    Polje {location.fieldLabel}
                </Typography>
            ) : null}
        </div>
    );
}

function WeekImageGallery({
    images,
}: {
    images: PublicHarvestTraceTimelineImage[];
}) {
    if (images.length === 0) {
        return null;
    }

    const galleryImages = images.map((image, index) => ({
        src: image.url,
        alt: image.alt ?? `Fotografija iz tjedna ${index + 1}`,
    }));

    if (galleryImages.length === 1) {
        return (
            <ImageGallery
                images={galleryImages}
                previewVariant="grid"
                previewWidth={180}
                previewHeight={135}
            />
        );
    }

    return (
        <>
            <div className="sm:hidden">
                <ImageGallery
                    images={galleryImages}
                    previewVariant="stacked"
                    previewWidth={180}
                    previewHeight={135}
                />
            </div>
            <div className="hidden sm:block">
                <ImageGallery
                    images={galleryImages}
                    previewVariant="grid"
                    previewLimitBeforeStack={2}
                    previewWidth={180}
                    previewHeight={135}
                />
            </div>
        </>
    );
}

function timelineItemCount(week: TimelineWeekGroup) {
    return week.days.reduce(
        (total, day) =>
            total +
            day.items.reduce(
                (dayTotal, item) => dayTotal + (item.operationCount ?? 1),
                0,
            ),
        0,
    );
}

function eventCountLabel(count: number) {
    return croatianPluralRules.select(count) === 'one'
        ? `${count} događaj`
        : `${count} događaja`;
}

function TimelineWeekCard({ week }: { week: TimelineWeekGroup }) {
    const count = timelineItemCount(week);

    return (
        <Card className="bg-card p-4 sm:p-5">
            <Stack spacing={4}>
                <Stack spacing={1}>
                    <Typography level="h3" className="text-xl sm:text-2xl">
                        {eventCountLabel(count)}
                    </Typography>
                </Stack>

                <WeekImageGallery images={week.images} />

                <div className="space-y-4">
                    {week.days.map((day) => (
                        <div key={day.dateKey} className="space-y-2">
                            <Typography
                                level="body2"
                                semiBold
                                className="text-primary"
                            >
                                {day.dateLabel}
                            </Typography>
                            <div className="space-y-2">
                                {day.items.map((item) => (
                                    <TimelineEvent key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Stack>
        </Card>
    );
}

function TraceTimeline({ trace }: { trace: PublicHarvestTrace }) {
    const monthGroups = groupTimelineByWeek(trace.timeline);
    const totalWeeks = monthGroups.reduce(
        (total, month) => total + month.weeks.length,
        0,
    );
    let weekIndex = 0;

    return (
        <section className="rounded-lg bg-background py-5 sm:py-7">
            {monthGroups.length > 0 ? (
                <Timeline>
                    {monthGroups.map((month, monthIndex) => (
                        <TimelineGroup
                            hasItems={month.weeks.length > 0}
                            isFirst={monthIndex === 0}
                            key={month.monthKey}
                            label={month.monthLabel}
                        >
                            {month.weeks.map((week) => {
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
                                        <TimelineWeekCard week={week} />
                                    </TimelineEntry>
                                );
                            })}
                        </TimelineGroup>
                    ))}
                </Timeline>
            ) : (
                <div className="rounded-lg bg-muted/30 p-4">
                    <Typography className="text-muted-foreground">
                        Za ovu berbu još nema javno dostupnih događaja.
                    </Typography>
                </div>
            )}
        </section>
    );
}

export default async function HarvestTracePage(
    props: PageProps<'/trag/[token]'>,
) {
    const { token } = await props.params;
    const trace = await loadTrace(token);

    if (!trace) {
        return <InvalidTraceState />;
    }

    await recordScan(token);

    return (
        <Stack spacing={5} className="py-4 sm:py-8">
            <TraceHero trace={trace} />
            <TraceTimeline trace={trace} />
            <TraceStatistics trace={trace} />
            <section className="rounded-lg bg-muted/20">
                <Stack spacing={3} alignItems="center" className="text-center">
                    <Typography level="h2" className="text-2xl sm:text-3xl">
                        O tragu berbe
                    </Typography>
                    <Typography className="text-muted-foreground">
                        Trag prikazuje javno dostupne podatke o ovoj berbi.
                        Privatni podaci vrta, korisnika i internih radnih
                        zadataka nisu prikazani.
                    </Typography>
                    <Typography level="body2">
                        <Link href="/" className="font-semibold underline">
                            Gredice
                        </Link>{' '}
                        povezuju digitalni vrt i stvarno povrće koje stiže na
                        kućni prag.
                    </Typography>
                </Stack>
            </section>
        </Stack>
    );
}
