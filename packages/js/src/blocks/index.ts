export type BlockPurchaseAvailability = {
    attributes?: {
        nightOnlyPurchase?: boolean | null;
    } | null;
};

export function isNightOnlyBlockPurchase(
    block: BlockPurchaseAvailability | null | undefined,
) {
    return block?.attributes?.nightOnlyPurchase === true;
}

export function isNightTimeOfDay(timeOfDay: number) {
    return timeOfDay <= 0.2 || timeOfDay >= 0.8;
}
