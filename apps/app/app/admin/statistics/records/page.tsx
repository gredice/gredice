import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { FactCard } from '../../../../components/admin/cards/FactCard';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { StatisticsSummaryCards } from '../../../../components/admin/statistics/StatisticsSummaryCards';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { getRecordsStatisticsData } from '../statisticsData';

export const dynamic = 'force-dynamic';

export default async function RecordsStatisticsPage() {
    await auth(['admin']);

    const records = await getRecordsStatisticsData();
    const totalRecords = records.reduce((total, item) => total + item.count, 0);
    const incompleteDrafts = records.reduce(
        (total, item) => total + item.incompleteDraftCount,
        0,
    );
    const incompletePublished = records.reduce(
        (total, item) => total + item.incompletePublishedCount,
        0,
    );

    return (
        <Stack spacing={4}>
            <AdminPageTitle title="Statistika zapisa" />
            <AdminPageHeader />

            <Stack spacing={2}>
                <Typography level="h3" component="h1">
                    Statistika zapisa
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Broj zapisa i pregled nepotpunih nacrta i objavljenih zapisa
                    prema vrsti.
                </Typography>
            </Stack>

            <StatisticsSummaryCards
                cards={[
                    {
                        label: 'Ukupno zapisa',
                        value: totalRecords.toLocaleString('hr-HR'),
                        detail: `${records.length} vrsta zapisa`,
                    },
                    {
                        label: 'Nepotpuni nacrti',
                        value: incompleteDrafts.toLocaleString('hr-HR'),
                        detail: 'Zapisi u stanju nacrta',
                    },
                    {
                        label: 'Nepotpuni objavljeni',
                        value: incompletePublished.toLocaleString('hr-HR'),
                        detail: 'Objavljeni zapisi kojima nedostaju podaci',
                    },
                ]}
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {records.map((record) => (
                    <FactCard
                        key={record.entityTypeName}
                        header={record.label}
                        value={
                            <Stack spacing={1}>
                                <Typography>{record.count}</Typography>
                                <Button
                                    variant="plain"
                                    size="sm"
                                    className="h-auto min-h-0 justify-start px-0"
                                    href={`${KnownPages.DirectoryEntityType(record.entityTypeName)}?completion=incomplete&state=draft`}
                                >
                                    Draft nepotpuni:{' '}
                                    {record.incompleteDraftCount}
                                </Button>
                                <Button
                                    variant="plain"
                                    size="sm"
                                    className="h-auto min-h-0 justify-start px-0"
                                    href={`${KnownPages.DirectoryEntityType(record.entityTypeName)}?completion=incomplete&state=published`}
                                >
                                    Objavljeno nepotpuni:{' '}
                                    {record.incompletePublishedCount}
                                </Button>
                            </Stack>
                        }
                        href={KnownPages.DirectoryEntityType(
                            record.entityTypeName,
                        )}
                    />
                ))}
            </div>
        </Stack>
    );
}
