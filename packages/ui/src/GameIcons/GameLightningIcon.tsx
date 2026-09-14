import type { SVGProps } from 'react';
import { GameIconFrame } from './GameIconFrame';
import { gameWeatherArtwork } from './gameWeatherArtwork';

export function GameLightningIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame
            label="Loši susjedi"
            source={gameWeatherArtwork.lightning}
            {...props}
        />
    );
}
