import type { SVGProps } from 'react';
import artwork from './assets/ruler.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameRulerIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Mjerenje" source={artwork} {...props} />;
}
