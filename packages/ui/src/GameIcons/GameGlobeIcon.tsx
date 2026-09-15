import type { SVGProps } from 'react';
import artwork from './assets/globe.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameGlobeIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Dostupnost" source={artwork} {...props} />;
}
