import type { SVGProps } from 'react';
import artwork from './assets/seedling.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSeedlingIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Biljka" source={artwork} {...props} />;
}
