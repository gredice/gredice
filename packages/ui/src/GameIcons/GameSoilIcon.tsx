import type { SVGProps } from 'react';
import artwork from './assets/soil.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSoilIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Tlo" source={artwork} {...props} />;
}
