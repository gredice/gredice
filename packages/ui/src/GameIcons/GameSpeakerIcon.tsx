import type { SVGProps } from 'react';
import artwork from './assets/speaker.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSpeakerIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Zvuk" source={artwork} {...props} />;
}
