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

export function SunflowersWeekCard({
    weekDays,
    data,
}: {
    weekDays: AnalyticsWeekDay[];
    data: SunflowersDailyData[];
}) {
    const daysByDate = new Map(data.map((day) => [day.date, day]));
    const columns = weekDays.map((day) => {
        const sunflowers = daysByDate.get(day.date);
        return {
            key: day.date,
            label: formatDashboardShortWeekday(day.date),
            description: formatDashboardLongDay(day.date),
            values:
                day.isFuture || !sunflowers
                    ? undefined
                    : { earned: sunflowers.earned, spent: sunflowers.spent },
        };
    });
    const totals = {
        earned: data.reduce((sum, day) => sum + day.earned, 0),
        spent: data.reduce((sum, day) => sum + day.spent, 0),
    };

    return (
        <DashboardChartCard
            title="Suncokreti"
            href={KnownPages.SunflowersStatistics}
            value={formatDashboardSignedNumber(totals.earned - totals.spent)}
            detail="Razlika zarađenih i potrošenih ovaj tjedan"
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
                title="Zarađeni i potrošeni suncokreti po danu ovaj tjedan"
                series={series}
                columns={columns}
                formatValue={formatDashboardNumber}
                emptyMessage="Nema promjena suncokreta ovaj tjedan."
            />
        </DashboardChartCard>
    );
}
