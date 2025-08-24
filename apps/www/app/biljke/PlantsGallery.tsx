'use client';

import type { PlantData } from '@gredice/client';
import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { orderBy } from '@signalco/js';
import { Gallery } from '@signalco/ui/Gallery';
import { Typography } from '@signalco/ui-primitives/Typography';
import { PlantsGalleryItem } from './PlantsGalleryItem';

export function PlantsGallery({ plants }: { plants: PlantData[] | undefined }) {
    const [search] = useSearchParam('pretraga');
    const filteredPlants = orderBy(plants ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.name),
    )
        .filter(
            (plant) =>
                !search ||
                plant.information.name
                    .toLowerCase()
                    .includes(search.toLowerCase()),
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
