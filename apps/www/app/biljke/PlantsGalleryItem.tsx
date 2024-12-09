import Image from "next/image";
import { ItemCard } from "../../components/shared/ItemCard";
import { PlantData } from "./[plantId]/page";

export function PlantsGalleryItem({
    id,
    information,
    image
}: Omit<PlantData, 'id'> & { id: string; }) {
    return (
        <ItemCard label={information.name} href={`/biljke/${id}`}>
            <Image
                src={image?.cover?.url ?? '/assets/plants/placeholder.png'}
                fill
                alt={information.name} />
        </ItemCard>
    );
}
