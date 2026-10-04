import type { SVGProps } from 'react';
import artwork from './assets/shovel.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameShovelIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Lopatica" source={artwork} {...props} />;
}
