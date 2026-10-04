import type { SVGProps } from 'react';
import artwork from './assets/weight.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameWeightIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Težina" source={artwork} {...props} />;
}
