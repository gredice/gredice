import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UsersRegistrationWeekdayCard } from '../../../../components/admin/dashboard/UsersRegistrationWeekdayCard';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { StatisticsSummaryCards } from '../../../../components/admin/statistics/StatisticsSummaryCards';
import { auth } from '../../../../lib/auth/auth';
import { StatisticsPeriodFilter } from '../StatisticsPeriodFilter';
import { getUserStatisticsData } from '../statisticsData';
import {
    resolveBoundedStatisticsPeriod,
    type StatisticsPeriodSearchParams,
} from '../statisticsPeriod';

export const dynamic = 'force-dynamic';

export default async function UsersStatisticsPage({
    searchParams,
}: {
    searchParams: Promise<StatisticsPeriodSearchParams>;
}) {
    await auth(['admin']);

    const period = resolveBoundedStatisticsPeriod(await searchParams);
    const registrations = await getUserStatisticsData(period);
    const totalRegistrations = registrations.reduce(
        (total, item) => total + item.count,
        0,
    );
    const mostFrequentDay = registrations.reduce(
        (best, item) => (item.count > best.count ? item : best),
        registrations[0] ?? { label: 'Nema podataka', count: 0 },
    );
    const activeRegistrationDays = registrations.filter(
        (item) => item.count > 0,
    ).length;

    return (
        <Stack spacing={4}>
            <AdminPageTitle title="Statistika korisnika" />
            <AdminPageHeader />

            <Stack spacing={2}>
                <Typography level="h3" component="h1">
                    Statistika korisnika
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Pregled registracija korisnika prema danima u tjednu.
                </Typography>
                <StatisticsPeriodFilter
                    initialPeriod={period.key}
                    initialFrom={period.pickerFrom}
                    initialTo={period.pickerTo}
                    maxDate={period.maxDate}
                    rangeLabel={period.rangeLabel}
                    label="Razdoblje registracija"
                    includeAllTime={false}
                />
            </Stack>

            <StatisticsSummaryCards
                cards={[
                    {
                        label: 'Registracije',
                        value: totalRegistrations.toLocaleString('hr-HR'),
                        detail: 'Ukupno u odabranom razdoblju',
                    },
                    {
                        label: 'Najčešći dan',
                        value:
                            mostFrequentDay.count > 0
                                ? mostFrequentDay.label
                                : '—',
                        detail: `${mostFrequentDay.count} registracija`,
                    },
                    {
                        label: 'Aktivni dani',
                        value: activeRegistrationDays.toString(),
                        detail: 'Dani u tjednu s registracijama',
                    },
                ]}
            />

            <div className="w-full xl:max-w-4xl">
                <UsersRegistrationWeekdayCard data={registrations} />
            </div>
        </Stack>
    );
}
