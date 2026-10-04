import type { FarmTodaySummary as FarmTodaySummaryData } from './farmTodayModel';
import { formatMinutes } from './schedule/scheduleShared';

type FarmTodaySummaryProps = {
    summary: FarmTodaySummaryData;
};

function minimumCount(count: number, complete: boolean) {
    return complete ? String(count) : `≥ ${count}`;
}

function remainingTime(summary: FarmTodaySummaryData) {
    if (summary.remainingDuration.complete) {
        return formatMinutes(summary.remainingDuration.minutes);
    }

    return summary.remainingDuration.minutes > 0
        ? `≥ ${formatMinutes(summary.remainingDuration.minutes)}`
        : '—';
}

export function FarmTodaySummary({ summary }: FarmTodaySummaryProps) {
    const metrics = [
        {
            label: 'Preostalo',
            value: minimumCount(summary.remaining, summary.countsComplete),
        },
        {
            label: 'Kasni',
            value: minimumCount(summary.overdue, summary.countsComplete),
        },
        {
            label: 'Čeka',
            value: minimumCount(
                summary.pendingVerification,
                summary.countsComplete,
            ),
        },
        {
            label: 'Vrijeme',
            value: remainingTime(summary),
        },
    ];

    return (
        <section
            aria-labelledby="farm-today-summary-title"
            className="rounded-lg border bg-card px-1 py-2 shadow-xs"
        >
            <h2 className="sr-only" id="farm-today-summary-title">
                Sažetak današnjih zadataka
            </h2>
            <div className="grid grid-cols-4 divide-x">
                {metrics.map((metric) => (
                    <div
                        className="min-w-0 px-1 text-center sm:px-2"
                        key={metric.label}
                    >
                        <div className="truncate text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            {metric.label}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
                            {metric.value}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
