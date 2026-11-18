import { KnownPages } from '../../../src/KnownPages';
import { DashboardChartCard } from './DashboardChartCard';
import { DashboardChartLegend } from './DashboardChartLegend';
import {
    DashboardColumnChart,
    type DashboardColumnChartSeries,
} from './DashboardColumnChart';
import { dashboardChartColors } from './dashboardChartColors';
import {
    createDashboardDateBuckets,
    sumDashboardBucket,
} from './dashboardDateBuckets';
import { formatDashboardNumber } from './dashboardFormat';
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

export function OperationsWeekCard({ data }: { data: OperationsDurationData }) {
    const columns = createDashboardDateBuckets(
        data.daily.map((day) => day.date),
    ).map((bucket) => ({
        ...bucket,
        values: {
            completed: sumDashboardBucket(
                data.daily,
                bucket.dates,
                (day) => day.operationsMinutes,
            ),
            sowing: sumDashboardBucket(
                data.daily,
                bucket.dates,
                (day) => day.sowingMinutes,
            ),
            planned: sumDashboardBucket(
                data.daily,
                bucket.dates,
                (day) => day.plannedMinutes,
            ),
        },
    }));
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
            detail="Ukupno trajanje u odabranom periodu"
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
                title="Trajanje radnji u odabranom periodu"
                series={series}
                columns={columns}
                formatValue={formatOperationsDuration}
                formatPeakLabel={formatCompactDuration}
                emptyMessage="Nema radnji u odabranom periodu."
            />
        </DashboardChartCard>
    );
}
