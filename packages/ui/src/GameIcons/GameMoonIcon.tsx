import type { SVGProps } from 'react';
import artwork from './assets/moon.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameMoonIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Mjesec" source={artwork} {...props} />;
}
