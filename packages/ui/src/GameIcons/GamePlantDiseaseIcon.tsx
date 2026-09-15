import type { SVGProps } from 'react';
import artwork from './assets/plant-disease.webp';
import { GameIconFrame } from './GameIconFrame';

export function GamePlantDiseaseIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame
            label="Ilustracija bolesti biljaka"
            source={artwork}
            {...props}
        />
    );
}
