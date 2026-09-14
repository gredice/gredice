import type { SVGProps } from 'react';
import artwork from './assets/health-plus.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameHealthIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame label="Zdravlje biljke" source={artwork} {...props} />
    );
}
