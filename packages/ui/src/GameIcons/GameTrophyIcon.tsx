import type { SVGProps } from 'react';
import artwork from './assets/trophy.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameTrophyIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Postignuća" source={artwork} {...props} />;
}
