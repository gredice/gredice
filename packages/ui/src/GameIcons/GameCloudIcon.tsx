import type { SVGProps } from 'react';
import artwork from './assets/cloud.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameCloudIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Oblačno" source={artwork} {...props} />;
}
