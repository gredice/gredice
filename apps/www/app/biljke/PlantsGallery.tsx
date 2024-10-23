'use client';

import { Typography } from "@signalco/ui-primitives/Typography";
import Image from "next/image";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { PlantData } from "./[plantId]/page";
import { ItemCard } from "../../components/shared/ItemCard";
import { Gallery } from "@signalco/ui/Gallery";

function PlantsGalleryItem(props: Omit<PlantData, 'id'> & { id: string }) {
    const plant = props;
    return (
        <ItemCard label={plant.information.name} href={`/biljke/${plant.id}`}>
            <Image
                src={plant.image?.cover?.url ?? '/assets/plants/placeholder.png'}
                fill
                alt={plant.information.name} />
        </ItemCard>
    );
}

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