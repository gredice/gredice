'use client';

import { Card, CardContent } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useMemo, useState } from 'react';
import {
    DEFAULT_DEPLOYMENT_STATS_PERIOD,
    type DeploymentDayStats,
    type DeploymentStatsPeriodMode,
    type DeploymentStatsPeriodSelection,
    type DeploymentStatsReadySnapshot,
    type DeploymentStatsSnapshot,
    type DeploymentStatsTotals,
} from './deploymentStatsTypes';

const numberFormatter = new Intl.NumberFormat('hr-HR');
const decimalFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
});
const updatedAtFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Zagreb',
});
const zagrebMonthFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: '2-digit',
});

type PeriodOption = {
    mode: DeploymentStatsPeriodMode;
    label: string;
};

const periodOptions: PeriodOption[] = [
    { mode: 'rolling-30-days', label: '30 dana' },
    { mode: 'last-month', label: 'Prošli mjesec' },
    { mode: 'month', label: 'Mjesec' },
];
const loadingMetricKeys = [
    'all',
    'production',
    'preview',
    'average',
    'ready-production',
];

function formatNumber(value: number) {
    return numberFormatter.format(value);
}

function formatAverage(value: number) {
    return decimalFormatter.format(value);
}

function formatUpdatedAt(value: string | null, isLoading: boolean) {
    if (isLoading) {
        return 'Osvježavanje...';
    }

    if (!value) {
        return 'Zaključeno razdoblje';
    }

    return `Osvježeno ${updatedAtFormatter.format(new Date(value))}`;
}

function shortDayLabel(date: string) {
    return date.slice(8);
}

function chartTitle(row: DeploymentDayStats) {
    return `${row.date}: ${formatNumber(row.production)} produkcijskih deploymenta, ${formatNumber(row.all)} ukupnih buildova`;
}

function shouldShowDayLabel(index: number, dayCount: number) {
    return index === 0 || index === dayCount - 1 || (index + 1) % 5 === 0;
}

function classNames(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(' ');
}

function currentMonthValue(date = new Date()) {
    const parts = zagrebMonthFormatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '00';

    return `${year}-${month}`;
}

function previousMonthValue(date = new Date()) {
    const [year = 0, month = 1] = currentMonthValue(date)
        .split('-')
        .map(Number);

    return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

function periodMode(period: DeploymentStatsPeriodSelection) {
    return period.mode;
}

function createPeriod(
    mode: DeploymentStatsPeriodMode,
    month: string,
): DeploymentStatsPeriodSelection {
    if (mode === 'month') {
        return {
            mode,
            month,
        };
    }

    if (mode === 'last-month') {
        return { mode };
    }

    return {
        mode: 'rolling-30-days',
    };
}

function deploymentStatsUrl(period: DeploymentStatsPeriodSelection) {
    const params = new URLSearchParams({ mode: period.mode });

    if (period.mode === 'month') {
        params.set('month', period.month);
    }

    return `/development/deployments?${params.toString()}`;
}

async function fetchDeploymentStats(
    period: DeploymentStatsPeriodSelection,
    signal: AbortSignal,
) {
    const response = await fetch(deploymentStatsUrl(period), {
        signal,
    });

    if (!response.ok) {
        throw new Error(`Deployment stats request failed: ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isDeploymentStatsSnapshot(payload)) {
        throw new Error('Deployment stats response has an unexpected shape.');
    }

    return payload;
}

function DeploymentStatsUnavailableState({
    description,
    title,
}: {
    description: string;
    title: string;
}) {
    return (
        <Stack spacing={4}>
            <Stack spacing={1}>
                <Typography level="h5" component="h3">
                    {title}
                </Typography>
                <Typography level="body3" tertiary>
                    {description}
                </Typography>
            </Stack>
            <div className="rounded-md border bg-muted/30 p-4">
                <Typography level="body2" secondary>
                    Deployment statistika trenutno nije dostupna.
                </Typography>
            </div>
        </Stack>
    );
}

function DeploymentStatsLoadingState() {
    return (
        <Stack spacing={4}>
            <Stack spacing={1}>
                <Typography level="h5" component="h3">
                    Zadnjih 30 dana
                </Typography>
                <Typography level="body3" tertiary>
                    Učitavanje deployment statistike...
                </Typography>
            </Stack>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {loadingMetricKeys.map((key) => (
                    <div
                        className="h-[76px] rounded-md border bg-muted/30"
                        key={key}
                    />
                ))}
            </div>
            <div className="h-36 rounded-md border bg-muted/20" />
        </Stack>
    );
}

function DeploymentStatsReadyState({
    isLoading,
    snapshot,
}: {
    isLoading: boolean;
    snapshot: DeploymentStatsReadySnapshot;
}) {
    const maxProduction = snapshot.dayRows.reduce(
        (max, row) => Math.max(max, row.production),
        0,
    );
    const busiestDay = snapshot.dayRows.reduce(
        (busiest, row) => (row.production > busiest.production ? row : busiest),
        snapshot.dayRows[0],
    );
    const metrics = [
        {
            label: 'Svi buildovi',
            value: formatNumber(snapshot.totals.all),
        },
        {
            label: 'Produkcija',
            value: formatNumber(snapshot.totals.production),
        },
        {
            label: 'Preview',
            value: formatNumber(snapshot.totals.preview),
        },
        {
            label: 'Prosjek / dan',
            value: formatAverage(snapshot.totals.productionAverage),
        },
        {
            label: 'Ready prod',
            value: formatNumber(snapshot.totals.readyProduction),
        },
    ];

    return (
        <Stack spacing={5}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <Stack spacing={1}>
                    <Typography level="h5" component="h3">
                        {snapshot.title}
                    </Typography>
                    <Typography level="body3" tertiary>
                        {snapshot.description}
                    </Typography>
                </Stack>
                <Typography level="body3" tertiary className="md:text-right">
                    {formatUpdatedAt(snapshot.updatedAt, isLoading)}
                </Typography>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {metrics.map((metric) => (
                    <div
                        className="min-w-0 rounded-md border bg-muted/30 p-3"
                        key={metric.label}
                    >
                        <Typography level="body3" tertiary className="truncate">
                            {metric.label}
                        </Typography>
                        <Typography level="h5" component="p" className="mt-1">
                            {metric.value}
                        </Typography>
                    </div>
                ))}
            </div>

            <Stack spacing={2}>
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <Typography level="body2" semiBold>
                        Produkcijski deploymenti po danu
                    </Typography>
                    {busiestDay ? (
                        <Typography level="body3" tertiary>
                            Najviše: {busiestDay.date} ·{' '}
                            {formatNumber(busiestDay.production)} prod /{' '}
                            {formatNumber(busiestDay.all)} ukupno
                        </Typography>
                    ) : null}
                </div>
                <DeploymentBars
                    dayRows={snapshot.dayRows}
                    maxProduction={maxProduction}
                />
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <Typography level="body3" tertiary>
                        Ukupno uključuje produkcijske, preview i neuspjele build
                        zapise.
                    </Typography>
                    <Typography level="body3" tertiary>
                        Error: {formatNumber(snapshot.totals.erroredProduction)}
                        , canceled:{' '}
                        {formatNumber(snapshot.totals.canceledProduction)}
                    </Typography>
                </div>
            </Stack>
        </Stack>
    );
}

function DeploymentBars({
    dayRows,
    maxProduction,
}: {
    dayRows: DeploymentDayStats[];
    maxProduction: number;
}) {
    return (
        <div className="rounded-md border bg-muted/20 px-3 pb-3 pt-4">
            <div className="flex h-28 items-end gap-1">
                {dayRows.map((row, index) => {
                    const percentage =
                        maxProduction > 0
                            ? (row.production / maxProduction) * 100
                            : 0;
                    const height =
                        row.production > 0
                            ? `${Math.max(8, percentage).toFixed(2)}%`
                            : '2px';

                    return (
                        <div
                            className="flex min-w-0 flex-1 flex-col items-center gap-2"
                            key={row.date}
                        >
                            <div className="flex h-24 w-full items-end rounded-sm bg-background/80 px-px">
                                <div
                                    className="w-full rounded-t-sm bg-primary"
                                    style={{ height }}
                                    title={chartTitle(row)}
                                />
                            </div>
                            {shouldShowDayLabel(index, dayRows.length) ? (
                                <span className="text-[10px] leading-none text-tertiary-foreground">
                                    {shortDayLabel(row.date)}
                                </span>
                            ) : (
                                <span className="h-2" aria-hidden />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PeriodControls({
    onPeriodChange,
    period,
    selectedMonth,
    setSelectedMonth,
}: {
    onPeriodChange: (period: DeploymentStatsPeriodSelection) => void;
    period: DeploymentStatsPeriodSelection;
    selectedMonth: string;
    setSelectedMonth: (month: string) => void;
}) {
    const activeMode = periodMode(period);
    const maxMonth = useMemo(() => currentMonthValue(), []);

    return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <fieldset
                className="grid grid-cols-3 rounded-md border bg-muted/30 p-1"
                aria-label="Razdoblje deployment statistike"
            >
                {periodOptions.map((option) => {
                    const active = activeMode === option.mode;

                    return (
                        <button
                            aria-pressed={active}
                            className={classNames(
                                'h-9 min-w-0 rounded-sm px-3 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                                active
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                            )}
                            key={option.mode}
                            onClick={() =>
                                onPeriodChange(
                                    createPeriod(option.mode, selectedMonth),
                                )
                            }
                            type="button"
                        >
                            {option.label}
                        </button>
                    );
                })}
            </fieldset>

            <label className="flex h-11 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium text-muted-foreground">
                Mjesec
                <input
                    className="min-w-0 bg-transparent text-sm font-semibold text-foreground outline-hidden"
                    max={maxMonth}
                    onChange={(event) => {
                        const month = event.target.value;
                        setSelectedMonth(month);
                        onPeriodChange({ mode: 'month', month });
                    }}
                    type="month"
                    value={selectedMonth}
                />
            </label>
        </div>
    );
}

export function DeploymentStatsCard() {
    const [period, setPeriod] = useState<DeploymentStatsPeriodSelection>(
        DEFAULT_DEPLOYMENT_STATS_PERIOD,
    );
    const [selectedMonth, setSelectedMonth] = useState(() =>
        previousMonthValue(),
    );
    const [snapshot, setSnapshot] = useState<DeploymentStatsSnapshot | null>(
        null,
    );
    const [isLoading, setIsLoading] = useState(true);
    const [hasRequestError, setHasRequestError] = useState(false);

    useEffect(() => {
        const abortController = new AbortController();
        setIsLoading(true);
        setHasRequestError(false);

        fetchDeploymentStats(period, abortController.signal)
            .then((nextSnapshot) => {
                setSnapshot(nextSnapshot);
                if (nextSnapshot.period.mode === 'month') {
                    setSelectedMonth(nextSnapshot.period.month);
                }
            })
            .catch((error: unknown) => {
                if (abortController.signal.aborted) {
                    return;
                }

                console.error('Failed to load deployment stats', error);
                setHasRequestError(true);
            })
            .finally(() => {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            });

        return () => {
            abortController.abort();
        };
    }, [period]);

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={5}>
                    <PeriodControls
                        onPeriodChange={setPeriod}
                        period={period}
                        selectedMonth={selectedMonth}
                        setSelectedMonth={setSelectedMonth}
                    />

                    {snapshot?.status === 'ready' ? (
                        <DeploymentStatsReadyState
                            isLoading={isLoading}
                            snapshot={snapshot}
                        />
                    ) : snapshot?.status === 'unavailable' ||
                      hasRequestError ? (
                        <DeploymentStatsUnavailableState
                            description={
                                snapshot?.description ??
                                'Odabrano razdoblje deploymenta'
                            }
                            title={snapshot?.title ?? 'Deployment statistika'}
                        />
                    ) : (
                        <DeploymentStatsLoadingState />
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

function isDeploymentStatsSnapshot(
    value: unknown,
): value is DeploymentStatsSnapshot {
    if (!isRecord(value)) {
        return false;
    }

    if (value.status === 'unavailable') {
        return (
            isPeriod(value.period) &&
            typeof value.title === 'string' &&
            typeof value.description === 'string' &&
            typeof value.reason === 'string'
        );
    }

    if (value.status !== 'ready') {
        return false;
    }

    return (
        isPeriod(value.period) &&
        typeof value.title === 'string' &&
        typeof value.description === 'string' &&
        typeof value.days === 'number' &&
        (typeof value.updatedAt === 'string' || value.updatedAt === null) &&
        isTotals(value.totals) &&
        Array.isArray(value.dayRows) &&
        value.dayRows.every(isDeploymentDayStats)
    );
}

function isPeriod(value: unknown): value is DeploymentStatsPeriodSelection {
    if (!isRecord(value)) {
        return false;
    }

    if (value.mode === 'rolling-30-days' || value.mode === 'last-month') {
        return true;
    }

    return value.mode === 'month' && typeof value.month === 'string';
}

function isTotals(value: unknown): value is DeploymentStatsTotals {
    return (
        isRecord(value) &&
        typeof value.all === 'number' &&
        typeof value.production === 'number' &&
        typeof value.preview === 'number' &&
        typeof value.readyProduction === 'number' &&
        typeof value.erroredProduction === 'number' &&
        typeof value.canceledProduction === 'number' &&
        typeof value.productionAverage === 'number'
    );
}

function isDeploymentDayStats(value: unknown): value is DeploymentDayStats {
    return (
        isRecord(value) &&
        typeof value.date === 'string' &&
        typeof value.all === 'number' &&
        typeof value.production === 'number' &&
        typeof value.readyProduction === 'number'
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
