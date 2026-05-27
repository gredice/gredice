'use client';

import { Suspense, useMemo } from 'react';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import { SpriteAtlasBillboard } from '../../sprites/SpriteAtlasBillboard';
import type { Block } from '../../types/Block';
import { useGameState } from '../../useGameState';
import { GardenFlowerModel } from '../helpers/GardenFlowerModel';
import type { BlockSurfaceDecorationPlacement } from './getBlockSurfaceDecorations';
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

type DirectBlockSurfaceDecorationSpritesProps = {
    block: Block;
    density?: number;
    surface: GroundDecorationSurface;
};

type PrecomputedBlockSurfaceDecorationSpritesProps = {
    blockId: string;
    placements: BlockSurfaceDecorationPlacement[];
    surface: GroundDecorationSurface;
    windDirection: number;
    windSpeed: number;
};

type BlockSurfaceDecorationSpritesProps =
    | DirectBlockSurfaceDecorationSpritesProps
    | PrecomputedBlockSurfaceDecorationSpritesProps;

function ResolvedBlockSurfaceDecorationSprites({
    block,
    density = 1,
    surface,
}: DirectBlockSurfaceDecorationSpritesProps) {
    const gameWeather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow();
    const placements = useMemo(
        () =>
            getBlockSurfaceDecorations({
                block,
                density,
                gardenId: null,
                surface,
            }),
        [block, density, surface],
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

    return (
        <PrecomputedBlockSurfaceDecorationSprites
            blockId={block.id}
            placements={placements}
            surface={surface}
            windDirection={windDirection}
            windSpeed={windSpeed}
        />
    );
}

export function PrecomputedBlockSurfaceDecorationSprites({
    blockId,
    placements,
    surface,
    windDirection,
    windSpeed,
}: PrecomputedBlockSurfaceDecorationSpritesProps) {
    return placements.map((placement) => {
        const positionKey = placement.position
            .map((value) => value.toFixed(3))
            .join(':');

        if (placement.kind === 'flower') {
            return (
                <Suspense
                    key={`${blockId}:${surface}:flower:${positionKey}`}
                    fallback={null}
                >
                    <GardenFlowerModel
                        petalColor={placement.color}
                        position={placement.position}
                        rotation={[0, placement.rotation, 0]}
                        scale={placement.scale}
                    />
                </Suspense>
            );
        }

        return (
            <SpriteAtlasBillboard
                key={`${blockId}:${surface}:${placement.spriteName}:${positionKey}`}
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

export function BlockSurfaceDecorationSprites(
    props: BlockSurfaceDecorationSpritesProps,
) {
    if ('placements' in props) {
        return <PrecomputedBlockSurfaceDecorationSprites {...props} />;
    }

    return <ResolvedBlockSurfaceDecorationSprites {...props} />;
}
