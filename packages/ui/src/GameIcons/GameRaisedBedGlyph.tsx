import type { SVGProps } from 'react';
import artwork from './assets/raised-bed.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameRaisedBedGlyph(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame
            label="Podignuta gredica"
            source={artwork}
            insetTop={11}
            {...props}
        />
    );
}
