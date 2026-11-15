import { croatianPlural } from '@gredice/js/i18n';
import { KnownPages } from '../../../src/KnownPages';
import { DashboardChartCard } from './DashboardChartCard';
import { DashboardColumnChart } from './DashboardColumnChart';
import { dashboardChartColors } from './dashboardChartColors';
import {
    createDashboardDateBuckets,
    sumDashboardBucket,
} from './dashboardDateBuckets';
import { formatDashboardNumber } from './dashboardFormat';

export function RegistrationsWeekCard({
    registrations,
}: {
    registrations: { date: string; count: number }[];
}) {
    const columns = createDashboardDateBuckets(
        registrations.map((day) => day.date),
    ).map((bucket) => ({
        ...bucket,
        values: {
            registrations: sumDashboardBucket(
                registrations,
                bucket.dates,
                (day) => day.count,
            ),
        },
    }));
    const total = registrations.reduce((sum, day) => sum + day.count, 0);
    const activeDays = registrations.filter((day) => day.count > 0).length;

    return (
        <DashboardChartCard
            title="Registracije"
            href={KnownPages.UsersStatistics}
            value={formatDashboardNumber(total)}
            detail={`Odabrani period · ${activeDays} ${croatianPlural(
                activeDays,
                {
                    one: 'dan',
                    few: 'dana',
                    many: 'dana',
                },
            )} s registracijama`}
        >
            <DashboardColumnChart
                title="Registracije korisnika u odabranom periodu"
                series={[
                    {
                        key: 'registrations',
                        label: 'Registracije',
                        colorClassName: dashboardChartColors.primary,
                    },
                ]}
                columns={columns}
                formatValue={formatDashboardNumber}
                emptyMessage="Nema registracija u odabranom periodu."
            />
        </DashboardChartCard>
    );
}
