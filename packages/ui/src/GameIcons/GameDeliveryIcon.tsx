import type { SVGProps } from 'react';
import artwork from './assets/delivery.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameDeliveryIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Dostava" source={artwork} {...props} />;
}
