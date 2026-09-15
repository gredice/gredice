import type { SVGProps } from 'react';
import artwork from './assets/community.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameCommunityIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Zajednica" source={artwork} {...props} />;
}
