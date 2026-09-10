/// <reference types="next/image-types/global" />

import type { SVGProps } from 'react';
import cloud from './assets/cloud.webp';
import fog from './assets/fog.webp';
import lightning from './assets/lightning.webp';
import moon from './assets/moon.webp';
import raindrop from './assets/raindrop.webp';
import snowflake from './assets/snowflake.webp';
import sun from './assets/sun.webp';
import type { WeatherPart } from './weatherComposition';

const artwork = { sun, moon, cloud, raindrop, snowflake, lightning, fog };

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
