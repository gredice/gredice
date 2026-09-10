import type { SVGProps } from 'react';
import artwork from './assets/tools.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameToolsIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Vrtne radnje" source={artwork} {...props} />;
}
