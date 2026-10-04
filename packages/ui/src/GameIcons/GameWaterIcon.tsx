import type { SVGProps } from 'react';
import { GameIconFrame } from './GameIconFrame';
import { gameWeatherArtwork } from './gameWeatherArtwork';

export function GameWaterIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame
            label="Vlažnost tla"
            source={gameWeatherArtwork.water}
            {...props}
        />
    );
}
