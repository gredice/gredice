import {
    getAllRaisedBeds,
    getEntitiesFormatted,
    getRaisedBedFieldPlantCycles,
} from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
        <Stack spacing={4}>
            <Typography level="h4" component="h1">
                Statistika sijanja po sortama
            </Typography>
            <Stack spacing={2} className="md:flex-row">
                <Chip color="primary">Ukupno sijanja: {totalSowings}</Chip>
                <Chip>Sorti sa sijanjem: {sortedSowingSummary.length}</Chip>
            </Stack>
            <Card>
                <CardOverflow className="overflow-hidden rounded-[calc(var(--radius)-1px)]">
                    {sortedSowingSummary.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema evidentiranih sijanja.
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {sortedSowingSummary.map((summary, index) => (
                                <li
                                    key={summary.sortId}
                                    className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                >
                                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <Chip
                                                color="neutral"
                                                size="sm"
                                                variant="soft"
                                                className="mt-0.5 font-mono"
                                            >
                                                #{index + 1}
                                            </Chip>
                                            <Stack
                                                spacing={1}
                                                className="min-w-0"
                                            >
                                                <Typography
                                                    component="div"
                                                    level="body2"
                                                    className="min-w-0 truncate font-medium"
                                                    title={summary.name}
                                                >
                                                    {summary.name}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Sorta
                                                </Typography>
                                            </Stack>
                                        </div>
                                        <div className="grid min-w-0 grid-cols-2 gap-3 text-left sm:flex sm:items-center sm:justify-end sm:gap-6 sm:text-right">
                                            <Stack spacing={1}>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Broj sijanja
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    level="body2"
                                                    className="font-medium tabular-nums"
                                                >
                                                    {summary.sowingCount}
                                                </Typography>
                                            </Stack>
                                            <Stack spacing={1}>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Zadnje sijanje
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    level="body2"
                                                    className="font-medium tabular-nums"
                                                >
                                                    {summary.lastSowedAt ? (
                                                        <LocalDateTime
                                                            time={false}
                                                        >
                                                            {
                                                                summary.lastSowedAt
                                                            }
                                                        </LocalDateTime>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </Typography>
                                            </Stack>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
