import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import {
    groundDecorationOptions,
    resolveGroundDecorationSurface,
} from '../entities/groundDecorations/groundDecorationConfig';
import { getSlopedGroundNormalizedHeight } from '../entities/groundSurfaceHeight';
import {
    type AutumnTreeAnchor,
    getAutumnTreeInfluence,
} from './autumnAccumulation';
import { autumnSeed } from './autumnState';
import type { GameQualityProfileTier } from './gameQuality';

export const autumnGustCaps = {
    low: 2,
    'auto-constrained': 2,
    medium: 3,
    high: 4,
    custom: 3,
} satisfies Record<GameQualityProfileTier, number>;

export type AutumnGustAnchor = {
    id: string;
    x: number;
    y: number;
    z: number;
};

const maxGustAnchors = 64;
const gustPeriodSeconds = 12;
const gustDurationSeconds = 1.4;

/** Keep a stable, bounded set of exposed ground sites near deciduous trees. */
export function createAutumnGustAnchors({
    instances,
    exposedBlockIds,
    trees,
    gardenId,
    year,
}: {
    instances: readonly EntityBlockInstance[];
    exposedBlockIds: ReadonlySet<string>;
    trees: readonly AutumnTreeAnchor[];
    gardenId: number | undefined;
    year: number;
}) {
    const ranked: { anchor: AutumnGustAnchor; rank: number }[] = [];
    for (const instance of instances) {
        if (!exposedBlockIds.has(instance.block.id)) continue;
        const surface = resolveGroundDecorationSurface(instance.block.name);
        if (!surface) continue;
        if (
            getAutumnTreeInfluence(
                instance.position[0],
                instance.position[2],
                trees,
            ) <= 0.1
        )
            continue;

        const id = `${gardenId}:${year}:${instance.block.id}`;
        const localX = (autumnSeed(`${id}:x`) - 0.5) * 0.5;
        const localZ = (autumnSeed(`${id}:z`) - 0.5) * 0.5;
        const angle = (instance.rotation * Math.PI) / 2;
        const height =
            getSlopedGroundNormalizedHeight(
                instance.block.name,
                localX,
                localZ,
            ) ?? 1;
        ranked.push({
            anchor: {
                id,
                x:
                    instance.position[0] +
                    localX * Math.cos(angle) +
                    localZ * Math.sin(angle),
                y:
                    instance.position[1] +
                    0.2 +
                    (height - 1) *
                        groundDecorationOptions[surface].angleLiftPerUnit +
                    0.02,
                z:
                    instance.position[2] -
                    localX * Math.sin(angle) +
                    localZ * Math.cos(angle),
            },
            rank: autumnSeed(`${id}:rank`),
        });
    }
    ranked.sort(
        (a, b) => a.rank - b.rank || a.anchor.id.localeCompare(b.anchor.id),
    );
    return ranked.slice(0, maxGustAnchors).map(({ anchor }) => anchor);
}

export function resolveAutumnGustCount({
    tier,
    windSpeed,
    rain,
    snow,
    settledLeafAmount,
    anchorCount,
    enabled,
}: {
    tier: GameQualityProfileTier;
    windSpeed: number;
    rain: number;
    snow: number;
    settledLeafAmount: number;
    anchorCount: number;
    enabled: boolean;
}) {
    if (
        !enabled ||
        ![windSpeed, rain, snow, settledLeafAmount].every(Number.isFinite) ||
        anchorCount <= 0 ||
        windSpeed < 0.75 ||
        rain >= 0.6 ||
        snow >= 0.25 ||
        settledLeafAmount < 0.12
    )
        return 0;
    return Math.max(
        1,
        Math.floor(
            autumnGustCaps[tier] *
                (1 - Math.max(0, rain) * 0.65) *
                (1 - Math.max(0, snow) * 2),
        ),
    );
}

/** Closed-form event selection stays identical at the same frozen scene time. */
export function sampleAutumnGustWindow(
    time: number,
    gardenId: number | undefined,
    year: number,
    anchorCount: number,
) {
    if (!Number.isFinite(time) || anchorCount <= 0) return null;
    const elapsed = Math.max(0, time) + 2;
    const eventIndex = Math.floor(elapsed / gustPeriodSeconds);
    const ageSeconds = elapsed - eventIndex * gustPeriodSeconds;
    if (ageSeconds >= gustDurationSeconds) return null;
    const seed = `${gardenId}:${year}:gust:${eventIndex}`;
    return {
        anchorIndex: Math.floor(autumnSeed(`${seed}:anchor`) * anchorCount),
        eventIndex,
        progress: ageSeconds / gustDurationSeconds,
    };
}

export function sampleAutumnGustLeaf(
    id: string,
    index: number,
    progress: number,
    windSpeed: number,
    windDirection: number,
) {
    const wind = Math.min(3, Math.max(0, windSpeed));
    const direction = (windDirection * Math.PI) / 180;
    const phase = autumnSeed(`${id}:${index}:phase`);
    const travel = progress * (0.32 + wind * 0.16);
    const lift = Math.sin(progress * Math.PI) * (0.06 + phase * 0.09);
    return {
        x:
            (phase - 0.5) * 0.16 +
            Math.sin(direction) * travel +
            Math.sin(progress * 12 + phase * 6) * 0.025,
        y: lift,
        z:
            (autumnSeed(`${id}:${index}:z`) - 0.5) * 0.16 -
            Math.cos(direction) * travel,
        rotation: phase * Math.PI * 2 + progress * 8,
        scale: Math.max(0, Math.min(0.85, progress * 8, (1 - progress) * 8)),
    };
}
