import type { SVGProps } from 'react';
import artwork from './assets/logout.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameLogoutIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Odjava" source={artwork} {...props} />;
}
