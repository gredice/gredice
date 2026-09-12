import type { SVGProps } from 'react';
import artwork from './assets/heart.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameHeartIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Dobri susjedi" source={artwork} {...props} />;
}
