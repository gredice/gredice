import type { SVGProps } from 'react';
import artwork from './assets/backpack.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameBackpackIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame
            label="Ruksak"
            source={artwork}
            aria-hidden="true"
            {...props}
        />
    );
}
