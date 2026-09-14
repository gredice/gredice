import type { SVGProps } from 'react';
import artwork from './assets/history.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameHistoryIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Povijest" source={artwork} {...props} />;
}
