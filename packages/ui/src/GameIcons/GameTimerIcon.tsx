import type { SVGProps } from 'react';
import artwork from './assets/timer.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameTimerIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Trajanje" source={artwork} {...props} />;
}
