import type { SVGProps } from 'react';
import artwork from '../SunflowerVisuals/assets/mascot-3d.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSunflowerIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Suncokreti" source={artwork} {...props} />;
}
