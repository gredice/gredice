import type { RaisedBedHarvestBasketFillLevel } from './raisedBedHarvestRewards';

/** Fill level of each raised bed's harvest basket, by raised bed id. */
export type HarvestBasketFillSnapshot = ReadonlyMap<
    number,
    RaisedBedHarvestBasketFillLevel
>;

/**
 * `harvest` drops a new basket in like a placed block; `land` squashes a
 * basket that just received more produce.
 */
export type HarvestBasketBounceKind = 'harvest' | 'land';

const fillRank = {
    empty: 0,
    partial: 1,
    full: 2,
} as const satisfies Record<RaisedBedHarvestBasketFillLevel, number>;

/**
 * Which baskets react to a harvest between two settled snapshots. The first
 * snapshot only records what was already there, so opening a garden does not
 * replay old harvests.
 */
export function resolveHarvestBasketBounces(
    previous: HarvestBasketFillSnapshot | null,
    next: HarvestBasketFillSnapshot,
) {
    const bounces = new Map<number, HarvestBasketBounceKind>();
    if (!previous) return bounces;
    for (const [raisedBedId, fillLevel] of next) {
        const before = previous.get(raisedBedId);
        if (before === undefined) bounces.set(raisedBedId, 'harvest');
        else if (fillRank[fillLevel] > fillRank[before])
            bounces.set(raisedBedId, 'land');
    }
    return bounces;
}

export type HarvestBasketBounce = {
    kind: HarvestBasketBounceKind;
    /** Grows by one for every bounce, so a repeated kind replays. */
    playKey: number;
};

/** Adds new bounces to the ones each basket has already played. */
export function applyHarvestBasketBounces(
    current: ReadonlyMap<number, HarvestBasketBounce>,
    bounces: ReadonlyMap<number, HarvestBasketBounceKind>,
) {
    if (bounces.size === 0) return current;
    const next = new Map(current);
    for (const [raisedBedId, kind] of bounces) {
        next.set(raisedBedId, {
            kind,
            playKey: (current.get(raisedBedId)?.playKey ?? 0) + 1,
        });
    }
    return next;
}
