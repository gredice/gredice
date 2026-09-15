import type { SVGProps } from 'react';
import artwork from './assets/gift.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameGiftIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Preporuke" source={artwork} {...props} />;
}
