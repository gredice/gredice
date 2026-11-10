import { croatianPlural } from '@gredice/js/i18n';
import { KnownPages } from '../../../src/KnownPages';
import type { AnalyticsWeekDay } from './analyticsDateRange';
import { DashboardChartCard } from './DashboardChartCard';
import { DashboardColumnChart } from './DashboardColumnChart';
import { dashboardChartColors } from './dashboardChartColors';
import {
    formatDashboardLongDay,
    formatDashboardNumber,
    formatDashboardShortWeekday,
} from './dashboardFormat';
import type { WeekdayRegistrationData } from './UsersRegistrationWeekdayCard';

export function RegistrationsWeekCard({
    weekDays,
    registrations,
}: {
    weekDays: AnalyticsWeekDay[];
    /** Registrations indexed by weekday, Sunday first. */
    registrations: WeekdayRegistrationData[];
}) {
    const columns = weekDays.map((day) => ({
        key: day.date,
        label: formatDashboardShortWeekday(day.date),
        description: formatDashboardLongDay(day.date),
        values: day.isFuture
            ? undefined
            : { registrations: registrations[day.weekday]?.count ?? 0 },
    }));
    const total = registrations.reduce((sum, day) => sum + day.count, 0);
    const activeDays = columns.filter(
        (column) => (column.values?.registrations ?? 0) > 0,
    ).length;

    return (
        <DashboardChartCard
            title="Registracije"
            href={KnownPages.UsersStatistics}
            value={formatDashboardNumber(total)}
            detail={`Ovaj tjedan · ${activeDays} ${croatianPlural(activeDays, {
                one: 'dan',
                few: 'dana',
                many: 'dana',
            })} s registracijama`}
        >
            <DashboardColumnChart
                title="Registracije korisnika po danu ovaj tjedan"
                series={[
                    {
                        key: 'registrations',
                        label: 'Registracije',
                        colorClassName: dashboardChartColors.primary,
                    },
                ]}
                columns={columns}
                formatValue={formatDashboardNumber}
                emptyMessage="Nema registracija ovaj tjedan."
            />
        </DashboardChartCard>
    );
}
