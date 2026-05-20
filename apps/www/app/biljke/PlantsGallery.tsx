'use client';

import type { PlantData } from '@gredice/client';
import { orderBy } from '@signalco/js';
import { Gallery } from '@signalco/ui/Gallery';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import type { PlantSortData } from '../../lib/plants/getPlantSortsData';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { PlantsGalleryItem } from './PlantsGalleryItem';

export function PlantsGallery({
    initialSearch = '',
    initialSeedTimeFilter = '',
    plants,
    sorts,
}: {
    initialSearch?: string;
    initialSeedTimeFilter?: string;
    plants: (PlantData & { isRecommended?: boolean })[] | undefined;
    sorts: PlantSortData[] | undefined;
}) {
    const [search] = useClientSearchParam('pretraga', initialSearch);
    const [seedTimeFilter] = useClientSearchParam(
        'vrijemeZaSijanje',
        initialSeedTimeFilter,
    );
    const normalizedSearch = normalizeSearchText(search);
    const onlySeedTimePlants = seedTimeFilter === '1';
    const normalizedSortNamesByPlantId = (sorts ?? []).reduce((acc, sort) => {
        const plantId = sort.information.plant?.id;
        const sortName = sort.information.name;
        if (!plantId || !sortName) {
            return acc;
        }

        const normalized = normalizeSearchText(sortName);
        const existing = acc.get(plantId) ?? [];
        acc.set(plantId, [...existing, normalized]);
        return acc;
    }, new Map<number, string[]>());
    const filteredPlants = orderBy(plants ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.name),
    )
        .filter((plant) => !onlySeedTimePlants || plant.isRecommended)
        .filter(
            (plant) =>
                !normalizedSearch ||
                normalizeSearchText(plant.information.name).includes(
                    normalizedSearch,
                ) ||
                (normalizedSortNamesByPlantId
                    .get(plant.id)
                    ?.some((sortName) => sortName.includes(normalizedSearch)) ??
                    false),
        )
        .map((plant) => {
            const matchingSortName = (sorts ?? []).find(
                (sort) =>
                    sort.information.plant?.id === plant.id &&
                    normalizeSearchText(sort.information.name).includes(
                        normalizedSearch,
                    ),
            )?.information.name;
            return {
                ...plant,
                id: plant.id.toString(),
                matchingSortName,
            };
        });

    return (
        <>
            {filteredPlants.length === 0 && (
                <Typography level="body2" className="py-8 text-center">
                    Nema rezultata pretrage.
                </Typography>
            )}
            <Gallery
                gridHeader=""
                items={filteredPlants}
                itemComponent={PlantsGalleryItem}
            />
        </>
    );
}
