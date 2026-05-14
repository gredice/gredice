'use client';

import type { PlantData } from '@gredice/client';
import { orderBy } from '@signalco/js';
import { Gallery } from '@signalco/ui/Gallery';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { PlantsGalleryItem } from './PlantsGalleryItem';

export function PlantsGallery({
    initialSearch = '',
    initialSeedTimeFilter = '',
    plants,
}: {
    initialSearch?: string;
    initialSeedTimeFilter?: string;
    plants: (PlantData & { isRecommended?: boolean })[] | undefined;
}) {
    const [search] = useClientSearchParam('pretraga', initialSearch);
    const [seedTimeFilter] = useClientSearchParam(
        'vrijemeZaSijanje',
        initialSeedTimeFilter,
    );
    const normalizedSearch = normalizeSearchText(search);
    const onlySeedTimePlants = seedTimeFilter === '1';
    const filteredPlants = orderBy(plants ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.name),
    )
        .filter((plant) => !onlySeedTimePlants || plant.isRecommended)
        .filter(
            (plant) =>
                !normalizedSearch ||
                normalizeSearchText(plant.information.name).includes(
                    normalizedSearch,
                ),
        )
        .map((plant) => ({ ...plant, id: plant.id.toString() }));

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
