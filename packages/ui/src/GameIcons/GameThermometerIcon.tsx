import type { SVGProps } from 'react';
import artwork from './assets/thermometer.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameThermometerIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame label="Temperatura tla" source={artwork} {...props} />
    );
}
