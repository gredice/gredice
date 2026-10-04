import type { SVGProps } from 'react';
import artwork from './assets/leaf.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameLeafIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="List" source={artwork} {...props} />;
}
