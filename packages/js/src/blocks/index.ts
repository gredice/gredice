export type BlockPurchaseAvailability = {
    attributes?: {
        nightOnlyPurchase?: boolean | null;
    } | null;
};

const defaultBlockImageBaseUrl = 'https://www.gredice.com/assets/blocks';

export function getBlockImageUrl(
    blockName: string | null | undefined,
    options?: { baseUrl?: string; version?: string | null },
) {
    const normalizedBlockName = blockName?.trim();
    if (!normalizedBlockName) {
        return null;
    }

    const baseUrl = (options?.baseUrl ?? defaultBlockImageBaseUrl).replace(
        /\/+$/u,
        '',
    );
    const version = (
        options?.version === undefined
            ? process.env.NEXT_PUBLIC_BLOCK_IMAGE_VERSION
            : options.version
    )?.trim();
    const versionQuery = version ? `?v=${encodeURIComponent(version)}` : '';
    return `${baseUrl}/${encodeURIComponent(normalizedBlockName)}.webp${versionQuery}`;
}

export function isNightOnlyBlockPurchase(
    block: BlockPurchaseAvailability | null | undefined,
) {
    return block?.attributes?.nightOnlyPurchase === true;
}

export function isNightTimeOfDay(timeOfDay: number) {
    return timeOfDay <= 0.2 || timeOfDay >= 0.8;
}
