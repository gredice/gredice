import type { SVGProps } from 'react';
import artwork from './assets/magnifier.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSearchIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Pretraga" source={artwork} {...props} />;
}
