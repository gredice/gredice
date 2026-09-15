import type { SVGProps } from 'react';
import artwork from './assets/sun.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSunIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Sunce" source={artwork} {...props} />;
}
