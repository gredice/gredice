'use client';

import type { EntityStandardized } from '@gredice/storage';
import { Search } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Route } from 'next';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
    getPlantSortLabel,
    getPlantSortSearchText,
    normalizePlantSearchText,
} from './plantUtils';

interface PlantsHandbookProps {
    plantSortsData: EntityStandardized[];
}

export function PlantsHandbook({ plantSortsData }: PlantsHandbookProps) {
    const [query, setQuery] = useState('');
    const normalizedQuery = normalizePlantSearchText(query);
    const sortedPlantSorts = useMemo(
        () =>
            [...plantSortsData].sort((left, right) =>
                getPlantSortLabel(left).localeCompare(
                    getPlantSortLabel(right),
                    undefined,
                    { numeric: true },
                ),
            ),
        [plantSortsData],
    );
    const filteredPlantSorts = sortedPlantSorts.filter(
        (plantSort) =>
            !normalizedQuery ||
            getPlantSortSearchText(plantSort).includes(normalizedQuery),
    );

    return (
        <Stack spacing={4}>
            <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-foreground">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Pretraži biljke"
                    className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
                />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPlantSorts.map((plantSort) => {
                    const plantSortLabel = getPlantSortLabel(plantSort);

                    return (
                        <Link
                            key={plantSort.id}
                            href={`/plants/${plantSort.id}` as Route}
                            aria-label={`Otvori detalje sorte ${plantSortLabel}`}
                            className="rounded-md border bg-white p-4 text-left text-foreground transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            <span className="flex min-w-0 items-center gap-3">
                                <PlantOrSortImage
                                    plantSort={plantSort}
                                    width={40}
                                    height={40}
                                    className="size-10 shrink-0 rounded-md object-cover"
                                />
                                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                                    {plantSortLabel}
                                </span>
                            </span>
                        </Link>
                    );
                })}
            </div>
            {filteredPlantSorts.length === 0 && (
                <div className="rounded-md border bg-white p-4">
                    <Typography className="text-muted-foreground">
                        Nema biljaka za prikaz.
                    </Typography>
                </div>
            )}
        </Stack>
    );
}
