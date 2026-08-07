import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { OperationsDurationCard } from '../../../../components/admin/dashboard/OperationsDurationCard';
import { formatOperationsDuration } from '../../../../components/admin/dashboard/operationsDuration';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { StatisticsSummaryCards } from '../../../../components/admin/statistics/StatisticsSummaryCards';
import { auth } from '../../../../lib/auth/auth';
import { StatisticsPeriodFilter } from '../StatisticsPeriodFilter';
import { getOperationsStatisticsData } from '../statisticsData';
import {
    resolveBoundedStatisticsPeriod,
    type StatisticsPeriodSearchParams,
} from '../statisticsPeriod';

export const dynamic = 'force-dynamic';

export default async function OperationsStatisticsPage({
    searchParams,
}: {
    searchParams: Promise<StatisticsPeriodSearchParams>;
}) {
    await auth(['admin']);

    const period = resolveBoundedStatisticsPeriod(await searchParams);
    const operations = await getOperationsStatisticsData(period);

    return (
        <Stack spacing={4}>
            <AdminPageTitle title="Statistika radnji" />
            <AdminPageHeader />

            <Stack spacing={2}>
                <Typography level="h3" component="h1">
                    Statistika radnji
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Trajanje završenih, planiranih i sjetvenih radnji kroz
                    odabrano razdoblje.
                </Typography>
                <StatisticsPeriodFilter
                    initialPeriod={period.key}
                    initialFrom={period.pickerFrom}
                    initialTo={period.pickerTo}
                    maxDate={period.maxDate}
                    rangeLabel={period.rangeLabel}
                    label="Razdoblje radnji"
                    includeAllTime={false}
                />
            </Stack>

            <StatisticsSummaryCards
                cards={[
                    {
                        label: 'Ukupno trajanje',
                        value: formatOperationsDuration(
                            operations.totalMinutes,
                        ),
                        detail: 'Sve evidentirane i planirane radnje',
                    },
                    {
                        label: 'Završene radnje',
                        value: formatOperationsDuration(
                            operations.operationsMinutes,
                        ),
                        detail: `${operations.byUser.reduce((total, user) => total + user.operationsCount, 0)} evidentiranih radnji`,
                    },
                    {
                        label: 'Planirano',
                        value: formatOperationsDuration(
                            operations.plannedMinutes,
                        ),
                        detail: `${operations.byUser.reduce((total, user) => total + user.plannedCount, 0)} planiranih radnji`,
                    },
                    {
                        label: 'Sijanje',
                        value: formatOperationsDuration(
                            operations.sowingMinutes,
                        ),
                        detail: 'Procijenjeno trajanje evidentiranih sijanja',
                    },
                ]}
            />

            <OperationsDurationCard data={operations} />
        </Stack>
    );
}
