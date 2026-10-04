import type { SVGProps } from 'react';
import artwork from './assets/plant-pest.webp';
import { GameIconFrame } from './GameIconFrame';

export function GamePlantPestIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame
            label="Ilustracija nametnika biljaka"
            source={artwork}
            {...props}
        />
    );
}
