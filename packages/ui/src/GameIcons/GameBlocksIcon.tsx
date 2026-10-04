import type { SVGProps } from 'react';
import artwork from './assets/blocks.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameBlocksIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Blokovi" source={artwork} {...props} />;
}
