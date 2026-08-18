import { getBlockImageUrl as getSharedBlockImageUrl } from '@gredice/js/blocks';

const localBlockImageNames = new Set([
    'BeachUmbrella',
    'LemonadeStand',
    'IceCreamCart',
    'SummerHat',
    'BeachTowelStriped',
    'InflatablePoolSmall',
    'BeachChair',
    'PalmTree',
    'BeachBall',
    'SandcastleSmallA',
]);

export function getBlockImageUrl(
    blockName: string,
    options?: { rotationSuffix?: number | string },
) {
    const suffix = options?.rotationSuffix ? `_${options.rotationSuffix}` : '';
    return (
        getSharedBlockImageUrl(`${blockName}${suffix}`, {
            baseUrl: localBlockImageNames.has(blockName)
                ? '/assets/blocks'
                : undefined,
        }) ?? ''
    );
}
