import type { SVGProps } from 'react';
import artwork from './assets/basket.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameBasketIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Košarica" source={artwork} {...props} />;
}
