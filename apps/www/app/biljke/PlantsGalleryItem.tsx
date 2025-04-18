import { ItemCard } from "../../components/shared/ItemCard";
import { PlantData } from "./[alias]/page";
import { KnownPages } from "../../src/KnownPages";
import { PlantImage } from "../../components/plants/PlantImage";

export function PlantsGalleryItem(props: Pick<PlantData, 'information' | 'image'>) {
    return (
        <ItemCard label={props.information.name} href={KnownPages.Plant(props.information.name)}>
            <PlantImage plant={props} fill />
        </ItemCard>
    );
}
