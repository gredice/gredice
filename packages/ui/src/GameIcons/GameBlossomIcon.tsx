import type { SVGProps } from 'react';
import artwork from './assets/blossom.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameBlossomIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Cvijet" source={artwork} {...props} />;
}
