import Image, { type ImageProps } from 'next/image';
import { resolveProceduralPlantType } from './plantNamesWithProceduralModels';

export type PlantBlockImageStage = 'seedling' | 'growing' | 'mature';

type PlantBlockImageProps = Omit<ImageProps, 'src' | 'alt'> & {
    plantName: string;
    alt?: string;
    stage?: PlantBlockImageStage;
};

export function PlantBlockImage({
    plantName,
    alt,
    stage = 'mature',
    ...rest
}: PlantBlockImageProps) {
    const plantType = resolveProceduralPlantType(plantName);
    const src = plantType
        ? `/assets/plants/${plantType}_${stage}.png`
        : '/assets/plants/placeholder.png';

    return <Image src={src} alt={alt ?? plantName} {...rest} />;
}
