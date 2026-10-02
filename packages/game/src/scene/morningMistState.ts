import type { BlockData } from '@gredice/client';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { getWaterBlockVerticalRange } from '../entities/waterBlockHeight';
import { isWaterBlockName, waterBlockNames } from '../entities/waterBlockNames';
import { autumnSeed } from './autumnState';
import type { GameQualityProfileTier } from './gameQuality';
import { smoothstep, visualDayNightTimes } from './visualDayNight';
import type { EnvironmentWeather } from './weatherBlend';

export const morningMistSurfaceNames = [
    'Block_Grass',
    'Block_Swamp_Ground',
    ...waterBlockNames,
];
export const morningMistCaps = {
    low: 0,
    'auto-constrained': 0,
    medium: 16,
    high: 32,
    custom: 24,
} satisfies Record<GameQualityProfileTier, number>;

export type MorningMistAnchor = {
    id: string;
    position: [number, number, number];
    phase: number;
    radius: number;
};

/** Same normalized solar day and blended fog as Environment; no season heuristic. */
export function resolveMorningMistDensity(
    timeOfDay: number,
    weather: EnvironmentWeather | undefined,
    snowCoverage = 0,
) {
    const values = [
        timeOfDay,
        weather?.foggy ?? 0,
        weather?.rainy ?? 0,
        weather?.snowy ?? 0,
        weather?.windSpeed ?? 0,
        snowCoverage,
    ];
    if (!values.every(Number.isFinite)) return 0;
    const morning =
        smoothstep(
            visualDayNightTimes.dawnNightEnd,
            visualDayNightTimes.dawnLightEnd,
            timeOfDay,
        ) *
        (1 - smoothstep(0.32, 0.48, timeOfDay));
    return (
        morning *
        smoothstep(0.05, 0.8, weather?.foggy ?? 0) *
        (1 - smoothstep(0.6, 2, weather?.windSpeed ?? 0)) *
        (1 - smoothstep(0.3, 0.85, weather?.rainy ?? 0)) *
        (1 - smoothstep(0, 0.1, Math.max(snowCoverage, weather?.snowy ?? 0)))
    );
}

export function createMorningMistAnchors({
    instances,
    coveredCells,
    blockData,
    gardenId,
    tier,
}: {
    instances: readonly EntityBlockInstance[];
    coveredCells: ReadonlySet<string>;
    blockData: BlockData[];
    gardenId: number | undefined;
    tier: GameQualityProfileTier;
}): MorningMistAnchor[] {
    if (!morningMistCaps[tier]) return [];
    return instances
        .filter(
            ({ block, blockIndex, stack, pickupOutlineVisible }) =>
                morningMistSurfaceNames.includes(block.name) &&
                blockIndex === stack.blocks.length - 1 &&
                !pickupOutlineVisible &&
                !coveredCells.has(`${stack.position.x}:${stack.position.z}`),
        )
        .map((instance) => ({
            instance,
            id: `${gardenId}:${instance.block.id}:morning-mist`,
        }))
        .sort(
            (a, b) =>
                autumnSeed(a.id) - autumnSeed(b.id) || a.id.localeCompare(b.id),
        )
        .slice(0, morningMistCaps[tier])
        .map(({ instance, id }) => {
            const surfaceY = isWaterBlockName(instance.block.name)
                ? (getWaterBlockVerticalRange({
                      block: instance.block,
                      stack: instance.stack,
                      blockData,
                  })?.max ?? 0)
                : instance.stackHeight + 0.4;
            return {
                id,
                position: [
                    instance.position[0],
                    surfaceY + 0.09,
                    instance.position[2],
                ],
                phase: autumnSeed(id),
                // Entire quad fits inside its tile; texture drift cannot cross into paths.
                radius: 0.36 + autumnSeed(`${id}:radius`) * 0.08,
            };
        });
}
