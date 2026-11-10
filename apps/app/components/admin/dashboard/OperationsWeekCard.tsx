import { KnownPages } from '../../../src/KnownPages';
import type { AnalyticsWeekDay } from './analyticsDateRange';
import { DashboardChartCard } from './DashboardChartCard';
import { DashboardChartLegend } from './DashboardChartLegend';
import {
    DashboardColumnChart,
    type DashboardColumnChartSeries,
} from './DashboardColumnChart';
import { dashboardChartColors } from './dashboardChartColors';
import {
    formatDashboardLongDay,
    formatDashboardNumber,
    formatDashboardShortWeekday,
} from './dashboardFormat';
import type { OperationsDurationData } from './OperationsDurationCard';
import { formatOperationsDuration } from './operationsDuration';

const series: DashboardColumnChartSeries<'completed' | 'sowing' | 'planned'>[] =
    [
        {
            key: 'completed',
            label: 'Odrađeno',
            colorClassName: dashboardChartColors.primary,
        },
        {
            key: 'sowing',
            label: 'Sijanje',
            colorClassName: dashboardChartColors.secondary,
        },
        {
            key: 'planned',
            label: 'Planirano',
            colorClassName: dashboardChartColors.tertiary,
        },
    ];

function formatCompactDuration(minutes: number) {
    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    }

    return `${formatDashboardNumber(minutes / 60)} h`;
}

export function OperationsWeekCard({
    weekDays,
    data,
}: {
    weekDays: AnalyticsWeekDay[];
    data: OperationsDurationData;
}) {
    const daysByDate = new Map(data.daily.map((day) => [day.date, day]));
    const columns = weekDays.map((day) => {
        const operations = daysByDate.get(day.date);
        return {
            key: day.date,
            label: formatDashboardShortWeekday(day.date),
            description: formatDashboardLongDay(day.date),
            values:
                day.isFuture || !operations
                    ? undefined
                    : {
                          completed: operations.operationsMinutes,
                          sowing: operations.sowingMinutes,
                          planned: operations.plannedMinutes,
                      },
        };
    });
    const totals = {
        completed: data.operationsMinutes,
        sowing: data.sowingMinutes,
        planned: data.plannedMinutes,
    };

    return (
        <DashboardChartCard
            title="Radnje"
            href={KnownPages.OperationsStatistics}
            value={formatOperationsDuration(data.totalMinutes)}
            detail="Ukupno trajanje ovaj tjedan"
            legend={
                <DashboardChartLegend
                    items={series.map((item) => ({
                        ...item,
                        value: formatOperationsDuration(totals[item.key]),
                    }))}
                />
            }
        >
            <DashboardColumnChart
                title="Trajanje radnji po danu ovaj tjedan"
                series={series}
                columns={columns}
                formatValue={formatOperationsDuration}
                formatPeakLabel={formatCompactDuration}
                emptyMessage="Nema radnji ovaj tjedan."
            />
        </DashboardChartCard>
    );
}
