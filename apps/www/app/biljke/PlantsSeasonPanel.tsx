'use client';

import { formatPrice } from '@gredice/js/currency';
import { Button } from '@gredice/ui/Button';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Link from 'next/link';
import { useMemo } from 'react';
import { Card } from '../../components/shared/Card';
import {
    calendarMonthLocativeNames,
    calendarMonthNames,
} from '../../lib/plants/calendarActivities';
import { KnownPages } from '../../src/KnownPages';
import {
    compareCataloguePlantNames,
    type PlantCatalogueItem,
} from './plantCatalogue';
import {
    formatPlantCount,
    isPlantAvailableInStore,
    isPlantHarvestedInMonth,
    type PlantSeasonActivity,
    plantArchiveResultsId,
    plantSowingWindowEdge,
    rankSowablePlants,
} from './plantSeason';
import {
    type PlantArchiveFilterDefaults,
    usePlantArchiveFilters,
} from './usePlantArchiveFilters';

const shownSowablePlants = 3;
const shownHarvestPlants = 4;

function sowingNote(plant: PlantCatalogueItem, month: number) {
    if (!isPlantAvailableInStore(plant)) {
        return {
            label: 'Trenutno nedostupno',
            className: 'text-muted-foreground',
        };
    }
    const edge = plantSowingWindowEdge(plant, month);
    if (edge === 'last') {
        return {
            label: 'Zadnji mjesec',
            className: 'text-amber-800 dark:text-amber-400',
        };
    }
    if (edge === 'first') {
        return {
            label: 'Od ovog mjeseca',
            className: 'text-lime-800 dark:text-lime-400',
        };
    }
    return {
        label: formatPrice(plant.prices?.perPlant),
        className: 'text-secondary-foreground',
    };
}

export function PlantsSeasonPanel({
    className,
    filters,
    plants,
}: {
    className?: string;
    filters: PlantArchiveFilterDefaults;
    plants: PlantCatalogueItem[];
}) {
    const { currentMonth } = filters;
    const { showSeason } = usePlantArchiveFilters(filters);
    const sowable = useMemo(
        () =>
            rankSowablePlants(plants, currentMonth, compareCataloguePlantNames),
        [currentMonth, plants],
    );
    const harvested = useMemo(
        () =>
            plants
                .filter((plant) => isPlantHarvestedInMonth(plant, currentMonth))
                .sort(compareCataloguePlantNames),
        [currentMonth, plants],
    );
    const monthName = calendarMonthNames[currentMonth - 1] ?? '';
    const monthLocative = calendarMonthLocativeNames[currentMonth - 1] ?? '';
    const hiddenSowableCount = sowable.length - shownSowablePlants;
    const showCurrentSeason = (activity: PlantSeasonActivity) => {
        showSeason(activity, currentMonth);
        document
            .getElementById(plantArchiveResultsId)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <Card className={cx('flex flex-col gap-3.5 p-4 md:p-5', className)}>
            <Row
                justifyContent="space-between"
                className="flex-wrap items-baseline gap-x-3 gap-y-1"
            >
                <Typography level="h5" component="h2" className="font-semibold">
                    {monthName} u gredici
                </Typography>
                <Typography level="body3">Kontinentalna Hrvatska</Typography>
            </Row>
            <Stack spacing={2}>
                <Typography
                    level="body3"
                    className="font-bold uppercase tracking-wider text-lime-800 dark:text-lime-400"
                >
                    Vrijeme za sijanje
                </Typography>
                {sowable.slice(0, shownSowablePlants).map((plant) => {
                    const note = sowingNote(plant, currentMonth);
                    return (
                        <Link
                            key={plant.id}
                            href={KnownPages.Plant(plant.information.name)}
                            className="flex items-center gap-3 rounded-md bg-muted/70 p-1.5 pr-2.5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                        >
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-background">
                                <PlantOrSortImage
                                    plant={plant}
                                    width={36}
                                    height={36}
                                />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-semibold">
                                {plant.information.name}
                            </span>
                            <span
                                className={cx(
                                    'shrink-0 text-sm',
                                    note.className,
                                )}
                            >
                                {note.label}
                            </span>
                        </Link>
                    );
                })}
                {hiddenSowableCount > 0 && (
                    <Typography level="body2">
                        i još {formatPlantCount(hiddenSowableCount)}
                    </Typography>
                )}
                {sowable.length === 0 && (
                    <Typography level="body2">
                        Ovaj mjesec nema sijanja. Pogledaj što je u berbi.
                    </Typography>
                )}
            </Stack>
            {harvested.length > 0 && (
                <Row className="flex-wrap gap-x-3 gap-y-1 border-t pt-3.5">
                    <span className="flex shrink-0 pl-2">
                        {harvested.slice(0, shownHarvestPlants).map((plant) => (
                            <span
                                key={plant.id}
                                className="-ml-2 flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-muted"
                            >
                                <PlantOrSortImage
                                    plant={plant}
                                    width={26}
                                    height={26}
                                />
                            </span>
                        ))}
                    </span>
                    <Typography
                        level="body2"
                        className="flex-1 whitespace-nowrap"
                    >
                        {formatPlantCount(harvested.length)} u berbi
                    </Typography>
                    <Button
                        variant="link"
                        className="whitespace-nowrap"
                        onClick={() => showCurrentSeason('berba')}
                    >
                        Prikaži berbu
                    </Button>
                </Row>
            )}
            {sowable.length > 0 && (
                <Button
                    className="mt-auto"
                    fullWidth
                    onClick={() => showCurrentSeason('sijanje')}
                >
                    Prikaži sve za sijanje u {monthLocative}
                </Button>
            )}
        </Card>
    );
}
