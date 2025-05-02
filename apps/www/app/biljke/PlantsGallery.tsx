'use client';

import { Typography } from "@signalco/ui-primitives/Typography";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { Gallery } from "@signalco/ui/Gallery";
import { PlantsGalleryItem } from "./PlantsGalleryItem";
import { orderBy } from "@signalco/js";
import { PlantData } from "../../lib/@types/PlantData";

export function PlantsGallery({ plants }: { plants: PlantData[] }) {
    const [search] = useSearchParam('pretraga');
    const filteredPlants = orderBy(plants, (a, b) => a.information.name.localeCompare(b.information.name))
        .filter(plant => !search || plant.information.name.toLowerCase().includes(search.toLowerCase()))
        .map(plant => ({ ...plant, id: plant.id.toString() }));

    return (
        <>
            {filteredPlants.length === 0 && (
                <Typography level="body2" className="py-8 text-center">Nema rezultata pretrage.</Typography>
            )}
            <Gallery gridHeader="" items={filteredPlants} itemComponent={PlantsGalleryItem} />
        </>
    );
}