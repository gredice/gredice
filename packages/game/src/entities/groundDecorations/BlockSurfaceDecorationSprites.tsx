'use client';

import { useMemo } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import { SpriteAtlasBillboard } from '../../sprites/SpriteAtlasBillboard';
import type { Block } from '../../types/Block';
import { useGameState } from '../../useGameState';
import { getBlockSurfaceDecorations } from './getBlockSurfaceDecorations';
import {
    type GroundDecorationSurface,
    groundDecorationAtlasBasePath,
} from './groundDecorationConfig';

const compassToDirection: Record<string, number> = {
    E: 90,
    N: 0,
    NE: 45,
    NW: 315,
    S: 180,
    SE: 135,
    SW: 225,
    W: 270,
};

type BlockSurfaceDecorationSpritesProps = {
    block: Block;
    surface: GroundDecorationSurface;
};

export function BlockSurfaceDecorationSprites({
    block,
    surface,
}: BlockSurfaceDecorationSpritesProps) {
    const { data: garden } = useCurrentGarden();
    const gameWeather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow();
    const placements = useMemo(
        () =>
            getBlockSurfaceDecorations({
                block,
                gardenId: garden?.id,
                surface,
            }),
        [block, garden?.id, surface],
    );
    const windSpeed =
        typeof gameWeather?.windSpeed === 'number'
            ? gameWeather.windSpeed
            : (weatherNow?.windSpeed ?? 0);
    const windDirection =
        typeof gameWeather?.windDirection === 'number'
            ? gameWeather.windDirection
            : typeof weatherNow?.windDirection === 'string'
              ? (compassToDirection[weatherNow.windDirection] ?? 0)
              : 0;

    return placements.map((placement) => {
        const positionKey = placement.position
            .map((value) => value.toFixed(3))
            .join(':');

        return (
            <SpriteAtlasBillboard
                key={`${block.id}:${surface}:${placement.spriteName}:${positionKey}`}
                alphaTest={0.06}
                atlasBasePath={groundDecorationAtlasBasePath}
                height={placement.height}
                opacity={placement.opacity}
                position={placement.position}
                renderOrder={20}
                spriteName={placement.spriteName}
                windDirection={windDirection}
                windSpeed={windSpeed}
            />
        );
    });
}
