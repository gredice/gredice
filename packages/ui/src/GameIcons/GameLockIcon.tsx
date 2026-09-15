import type { SVGProps } from 'react';
import artwork from './assets/lock.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameLockIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Sigurnost" source={artwork} {...props} />;
}
