import type { SVGProps } from 'react';
import artwork from './assets/profile.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameProfileIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Profil" source={artwork} {...props} />;
}
