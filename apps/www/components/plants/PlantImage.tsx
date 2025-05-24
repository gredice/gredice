import Image, { ImageProps } from "next/image";
import { PlantData } from "@gredice/client";

export function PlantImage({ plant, ...rest }: Omit<ImageProps, 'src' | 'alt'> & { plant: Pick<PlantData, 'image' | 'information'> }) {
    return (
        <Image
            src={plant.image?.cover?.url ?? '/assets/plants/placeholder.png'}
            alt={`Slika ${plant.information.name}`}
            {...rest}
        />
    )
}