import Image from "next/image";
import { ItemCard } from "../../components/shared/ItemCard";
import { PlantData } from "./[alias]/page";
import { KnownPages } from "../../src/KnownPages";

export function PlantsGalleryItem({
    information,
    image
}: Omit<PlantData, 'id'> & { id: string; }) {
    return (
        <ItemCard label={information.name} href={KnownPages.Plant(information.name)}>
            <Image
                src={image?.cover?.url ?? '/assets/plants/placeholder.png'}
                fill
                alt={information.name} />
        </ItemCard>
    );
}
