import type { SVGProps } from 'react';
import soilArtwork from './assets/soil.webp';
import { GameIconFrame } from './GameIconFrame';
import { GameRulerIcon } from './GameRulerIcon';

/** The same soil and ruler artwork, composed into a depth measurement. */
export function GameSowingDepthIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame label="Dubina sijanja" source={soilArtwork} {...props}>
            <GameRulerIcon
                aria-hidden
                x={20}
                y={0}
                width={28}
                height={28}
                transform="rotate(-45 34 14)"
            />
        </GameIconFrame>
    );
}
