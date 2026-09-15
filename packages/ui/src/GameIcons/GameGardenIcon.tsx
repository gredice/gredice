import type { SVGProps } from 'react';
import artwork from './assets/garden-island.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameGardenIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Vrtovi za igru" source={artwork} {...props} />;
}
