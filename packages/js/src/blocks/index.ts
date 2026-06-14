export type BlockPurchaseAvailability = {
    attributes?: {
        nightOnlyPurchase?: boolean | null;
    } | null;
};

const defaultBlockImageBaseUrl = 'https://www.gredice.com/assets/blocks';

export function getBlockImageUrl(
    blockName: string | null | undefined,
    options?: { baseUrl?: string },
) {
    const normalizedBlockName = blockName?.trim();
    if (!normalizedBlockName) {
        return null;
    }

    const baseUrl = (options?.baseUrl ?? defaultBlockImageBaseUrl).replace(
        /\/+$/u,
        '',
    );
    return `${baseUrl}/${encodeURIComponent(normalizedBlockName)}.webp`;
}

export function isNightOnlyBlockPurchase(
    block: BlockPurchaseAvailability | null | undefined,
) {
    return block?.attributes?.nightOnlyPurchase === true;
}

export function isNightTimeOfDay(timeOfDay: number) {
    return timeOfDay <= 0.2 || timeOfDay >= 0.8;
}
