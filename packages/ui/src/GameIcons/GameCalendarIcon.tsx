import type { SVGProps } from 'react';
import artwork from './assets/calendar.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameCalendarIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Kalendar" source={artwork} {...props} />;
}
