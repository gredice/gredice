import type { SVGProps } from 'react';
import artwork from './assets/sunflower.svg';
import { GameIconFrame } from './GameIconFrame';

export function GameSunflowerIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Suncokreti" source={artwork} {...props} />;
}
