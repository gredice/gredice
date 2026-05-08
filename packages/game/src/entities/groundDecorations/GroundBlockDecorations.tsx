'use client';

import { Fragment, useEffect, useMemo } from 'react';
import { useBlockData } from '../../hooks/useBlockData';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
import { BlockSurfaceDecorationSprites } from './BlockSurfaceDecorationSprites';
import { getBlockSurfaceDecorations } from './getBlockSurfaceDecorations';
import { resolveGroundDecorationSurface } from './groundDecorationConfig';

const blockSurfaceYOffset = 0.2;
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

type GroundBlockDecorationsProps = {
    density: number;
    stacks: Stack[] | undefined;
};

export function GroundBlockDecorations({
    density,
    stacks,
}: GroundBlockDecorationsProps) {
    const { data: blockData } = useBlockData();
    const { data: garden } = useCurrentGarden();
    const gameWeather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow();
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
    const decorationBlocks = useMemo(() => {
        if (!stacks || density <= 0) {
            return [];
        }

        return stacks.flatMap((stack) =>
            stack.blocks.flatMap((block) => {
                const surface = resolveGroundDecorationSurface(block.name);
                if (!surface) {
                    return [];
                }

                const placements = getBlockSurfaceDecorations({
                    block,
                    density,
                    gardenId: garden?.id,
                    surface,
                });

                if (!placements.length) {
                    return [];
                }

                return [
                    {
                        block,
                        placements,
                        stack,
                        surface,
                    },
                ];
            }),
        );
    }, [density, garden?.id, stacks]);
    const decorationCount = decorationBlocks.reduce(
        (sum, block) => sum + block.placements.length,
        0,
    );

    useEffect(() => {
        updateGameProfileMetadata({
            groundDecorationCount: decorationCount,
            groundDecorationDensity: density,
        });
    }, [decorationCount, density]);

    if (!stacks || density <= 0 || !decorationBlocks.length) {
        return null;
    }

    return (
        <>
            {stacks.map((stack) => (
                <Fragment
                    key={`ground-decorations:${stack.position.x}:${stack.position.z}`}
                >
                    {decorationBlocks
                        .filter((block) => block.stack === stack)
                        .map(({ block, placements, surface }) => {
                            return (
                                <group
                                    key={`ground-decoration:${block.id}`}
                                    position={[
                                        stack.position.x,
                                        getStackHeight(
                                            blockData,
                                            stack,
                                            block,
                                        ) + blockSurfaceYOffset,
                                        stack.position.z,
                                    ]}
                                    rotation={[
                                        0,
                                        block.rotation * (Math.PI / 2),
                                        0,
                                    ]}
                                >
                                    <BlockSurfaceDecorationSprites
                                        blockId={block.id}
                                        placements={placements}
                                        surface={surface}
                                        windDirection={windDirection}
                                        windSpeed={windSpeed}
                                    />
                                </group>
                            );
                        })}
                </Fragment>
            ))}
        </>
    );
}
