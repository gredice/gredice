/// <reference types="next/image-types/global" />

import { gameWeatherArtwork } from '@gredice/ui/GameIcons';
import type { SVGProps } from 'react';
import cloud from './assets/cloud.webp';
import fog from './assets/fog.webp';
import type { WeatherPart } from './weatherComposition';

const artwork = {
    sun: gameWeatherArtwork.sun,
    moon: gameWeatherArtwork.moon,
    cloud,
    snowflake: gameWeatherArtwork.snowflake,
    fog,
    raindrop: gameWeatherArtwork.water,
    lightning: gameWeatherArtwork.lightning,
};

export function WeatherArtwork({
    part,
    ...props
}: SVGProps<SVGImageElement> & { part: WeatherPart }) {
    const source = artwork[part];
    return (
        <image
            href={typeof source === 'string' ? source : source.src}
            preserveAspectRatio="xMidYMid meet"
            data-weather-part={part}
            {...props}
        />
    );
}
