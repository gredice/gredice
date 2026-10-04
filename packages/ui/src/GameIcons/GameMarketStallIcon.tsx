import type { SVGProps } from 'react';
import artwork from './assets/market-stall.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameMarketStallIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Proizvođač" source={artwork} {...props} />;
}
