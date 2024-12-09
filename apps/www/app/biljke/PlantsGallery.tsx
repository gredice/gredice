'use client';

import { Typography } from "@signalco/ui-primitives/Typography";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { PlantData } from "./[plantId]/page";
import { Gallery } from "@signalco/ui/Gallery";
import { PlantsGalleryItem } from "./PlantsGalleryItem";

export function PlantsGallery({ plants }: { plants: PlantData[] }) {
    const [search] = useSearchParam('pretraga');
    const filteredPlants = plants
        .filter(plant => !search || plant.information.name.toLowerCase().includes(search.toLowerCase()))
        .map(plant => ({ ...plant, id: plant.id.toString() }));

    return (
        <>
            {filteredPlants.length === 0 && (
                <Typography level="body2">Nema rezultata pretrage.</Typography>
            )}
            <Gallery gridHeader="" items={filteredPlants} itemComponent={PlantsGalleryItem} />
        </>
    );
}