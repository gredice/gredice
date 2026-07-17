import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { SunflowersDailyCard } from '../../../../components/admin/dashboard/SunflowersDailyCard';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { StatisticsSummaryCards } from '../../../../components/admin/statistics/StatisticsSummaryCards';
import { auth } from '../../../../lib/auth/auth';
import { StatisticsPeriodFilter } from '../StatisticsPeriodFilter';
import { getSunflowersStatisticsData } from '../statisticsData';
import {
    resolveBoundedStatisticsPeriod,
    type StatisticsPeriodSearchParams,
} from '../statisticsPeriod';

export const dynamic = 'force-dynamic';

export default async function SunflowersStatisticsPage({
    searchParams,
}: {
    searchParams: Promise<StatisticsPeriodSearchParams>;
}) {
    await auth(['admin']);

    const period = resolveBoundedStatisticsPeriod(await searchParams);
    const sunflowers = await getSunflowersStatisticsData(period);
    const totalSpent = sunflowers.reduce((total, day) => total + day.spent, 0);
    const totalEarned = sunflowers.reduce(
        (total, day) => total + day.earned,
        0,
    );

    return (
        <Stack spacing={4}>
            <AdminPageTitle title="Statistika suncokreta" />
            <AdminPageHeader />

            <Stack spacing={2}>
                <Typography level="h3" component="h1">
                    Statistika suncokreta
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Pregled zarađenih i potrošenih suncokreta kroz odabrano
                    razdoblje.
                </Typography>
                <StatisticsPeriodFilter
                    initialPeriod={period.key}
                    initialFrom={period.pickerFrom}
                    initialTo={period.pickerTo}
                    maxDate={period.maxDate}
                    rangeLabel={period.rangeLabel}
                    label="Razdoblje promjena"
                    includeAllTime={false}
                />
            </Stack>

            <StatisticsSummaryCards
                cards={[
                    {
                        label: 'Zarađeno',
                        value: totalEarned.toLocaleString('hr-HR'),
                        detail: 'Ukupno u odabranom razdoblju',
                    },
                    {
                        label: 'Potrošeno',
                        value: totalSpent.toLocaleString('hr-HR'),
                        detail: 'Ukupno u odabranom razdoblju',
                    },
                    {
                        label: 'Neto promjena',
                        value: (totalEarned - totalSpent).toLocaleString(
                            'hr-HR',
                        ),
                        detail: 'Razlika zarade i potrošnje',
                    },
                ]}
            />

            <SunflowersDailyCard data={sunflowers} />
        </Stack>
    );
}
