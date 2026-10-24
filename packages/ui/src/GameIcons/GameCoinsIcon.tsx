import type { SVGProps } from 'react';
import artwork from './assets/coins.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameCoinsIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Cijena" source={artwork} {...props} />;
}
