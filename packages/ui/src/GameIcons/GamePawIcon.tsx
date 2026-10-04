import type { SVGProps } from 'react';
import artwork from './assets/paw.webp';
import { GameIconFrame } from './GameIconFrame';

export function GamePawIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Ljubimci" source={artwork} {...props} />;
}
