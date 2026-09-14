import type { SVGProps } from 'react';
import artwork from './assets/seed-packet.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSeedPacketIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Sijanje" source={artwork} {...props} />;
}
