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
import {
    formatDashboardNumber,
    formatDashboardSignedNumber,
} from './dashboardFormat';
import type { SunflowersDailyData } from './SunflowersDailyCard';

const series: DashboardColumnChartSeries<'earned' | 'spent'>[] = [
    {
        key: 'earned',
        label: 'Zarađeno',
        colorClassName: dashboardChartColors.secondary,
    },
    {
        key: 'spent',
        label: 'Potrošeno',
        colorClassName: dashboardChartColors.tertiary,
        below: true,
    },
];

export function SunflowersWeekCard({ data }: { data: SunflowersDailyData[] }) {
    const columns = createDashboardDateBuckets(data.map((day) => day.date)).map(
        (bucket) => ({
            ...bucket,
            values: {
                earned: sumDashboardBucket(
                    data,
                    bucket.dates,
                    (day) => day.earned,
                ),
                spent: sumDashboardBucket(
                    data,
                    bucket.dates,
                    (day) => day.spent,
                ),
            },
        }),
    );
    const totals = {
        earned: data.reduce((sum, day) => sum + day.earned, 0),
        spent: data.reduce((sum, day) => sum + day.spent, 0),
    };

    return (
        <DashboardChartCard
            title="Suncokreti"
            href={KnownPages.SunflowersStatistics}
            value={formatDashboardSignedNumber(totals.earned - totals.spent)}
            detail="Razlika zarađenih i potrošenih u odabranom periodu"
            legend={
                <DashboardChartLegend
                    items={series.map((item) => ({
                        ...item,
                        value: formatDashboardNumber(totals[item.key]),
                    }))}
                />
            }
        >
            <DashboardColumnChart
                title="Zarađeni i potrošeni suncokreti u odabranom periodu"
                series={series}
                columns={columns}
                formatValue={formatDashboardNumber}
                emptyMessage="Nema promjena suncokreta u odabranom periodu."
            />
        </DashboardChartCard>
    );
}
