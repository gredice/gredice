import {
    getAllRaisedBeds,
    getEntitiesFormatted,
    getRaisedBedFieldPlantCycles,
} from '@gredice/storage';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

type SortSowingSummary = {
    sortId: number;
    name: string;
    sowingCount: number;
    lastSowedAt: Date | null;
};

function compareSortSowingSummary(
    left: SortSowingSummary,
    right: SortSowingSummary,
) {
    if (left.sowingCount !== right.sowingCount) {
        return right.sowingCount - left.sowingCount;
    }

    return left.name.localeCompare(right.name, 'hr-HR');
}

export default async function SowingStatisticsPage() {
    await auth(['admin']);

    const [raisedBeds, plantSorts] = await Promise.all([
        getAllRaisedBeds(),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);

    const allPlantCycles = (
        await Promise.all(
            raisedBeds.map((raisedBed) =>
                getRaisedBedFieldPlantCycles(raisedBed.id),
            ),
        )
    ).flat();

    const sortNameById = new Map(
        (plantSorts ?? []).map((plantSort) => [
            plantSort.id,
            plantSort.information?.name?.trim() || `Sorta ${plantSort.id}`,
        ]),
    );
    const sownBySort = new Map<number, SortSowingSummary>();

    for (const cycle of allPlantCycles) {
        if (!cycle.plantSowDate || !cycle.plantSortId) {
            continue;
        }

        const existingSummary = sownBySort.get(cycle.plantSortId);
        if (existingSummary) {
            existingSummary.sowingCount += 1;
            if (
                !existingSummary.lastSowedAt ||
                existingSummary.lastSowedAt < cycle.plantSowDate
            ) {
                existingSummary.lastSowedAt = cycle.plantSowDate;
            }
            continue;
        }

        sownBySort.set(cycle.plantSortId, {
            sortId: cycle.plantSortId,
            name:
                sortNameById.get(cycle.plantSortId) ||
                `Nepoznata sorta #${cycle.plantSortId}`,
            sowingCount: 1,
            lastSowedAt: cycle.plantSowDate,
        });
    }

    const sortedSowingSummary = Array.from(sownBySort.values()).sort(
        compareSortSowingSummary,
    );
    const totalSowings = sortedSowingSummary.reduce(
        (sum, item) => sum + item.sowingCount,
        0,
    );

    return (
        <Stack spacing={2}>
            <Typography level="h4" component="h1">
                Statistika sijanja po sortama
            </Typography>
            <Stack spacing={1} className="md:flex-row">
                <Chip color="primary">Ukupno sijanja: {totalSowings}</Chip>
                <Chip>Sorti sa sijanjem: {sortedSowingSummary.length}</Chip>
            </Stack>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>#</Table.Head>
                                <Table.Head>Sorta</Table.Head>
                                <Table.Head className="text-right">
                                    Broj sijanja
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Zadnje sijanje
                                </Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {sortedSowingSummary.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={4}>
                                        <NoDataPlaceholder>
                                            Nema evidentiranih sijanja.
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {sortedSowingSummary.map((summary, index) => (
                                <Table.Row key={summary.sortId}>
                                    <Table.Cell>{index + 1}</Table.Cell>
                                    <Table.Cell>{summary.name}</Table.Cell>
                                    <Table.Cell className="text-right">
                                        {summary.sowingCount}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {summary.lastSowedAt
                                            ? summary.lastSowedAt.toLocaleDateString(
                                                  'hr-HR',
                                              )
                                            : '-'}
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
