import type { SVGProps } from 'react';
import artwork from './assets/location.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameLocationIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Lokacija" source={artwork} {...props} />;
}
