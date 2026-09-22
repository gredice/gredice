import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import type { GameQualityProfileTier } from './gameQuality';
import { getSeasonStartDate } from './seasonState';

export type AutumnTreeAnchor = { id: string; x: number; z: number };
export type AutumnLeafBatchData = {
    key: string;
    gradientX: number;
    gradientZ: number;
    variant: number;
    instances: EntityBlockInstance[];
};
export const autumnGroundCaps = {
    low: 48,
    'auto-constrained': 96,
    medium: 256,
    high: 512,
    custom: 384,
} satisfies Record<GameQualityProfileTier, number>;

/** Winter keeps the seed of the autumn that produced these leaves. */
export function getAutumnAccumulationYear(date: Date) {
    const year = date.getFullYear();
    return date < getSeasonStartDate('autumn', year) ? year - 1 : year;
}

export function getAutumnTreeInfluence(
    x: number,
    z: number,
    trees: readonly AutumnTreeAnchor[],
    windDirection = 0,
    windSpeed = 0,
) {
    return Math.min(
        1,
        trees.reduce(
            (amount, tree) =>
                amount +
                Math.max(0, 1 - Math.hypot(tree.x - x, tree.z - z) / 4) *
                    0.8 *
                    (1 +
                        Math.min(0.15, Math.max(0, windSpeed) * 0.05) *
                            Math.cos(
                                Math.atan2(z - tree.z, x - tree.x) -
                                    (windDirection * Math.PI) / 180,
                            )),
            0,
        ),
    );
}

export function resolveSettledLeafCount(
    amount: number,
    influence: number,
    snow: number,
    max = 8,
) {
    if (![amount, influence, snow].every(Number.isFinite)) return 0;
    return Math.floor(
        max *
            Math.min(1, Math.max(0, amount)) *
            Math.min(1, Math.max(0, influence)) *
            (1 - Math.min(1, Math.max(0, snow))) ** 2,
    );
}
