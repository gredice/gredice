import type { BlockData } from '@gredice/client';
import { isNightOnlyBlockPurchase, isNightTimeOfDay } from '@gredice/js/blocks';

export type HudEntityPlacementAvailability = {
    availabilityMessage: string | null;
    canPlace: boolean;
    hasEnoughSunflowers: boolean;
    hasSunflowerPrice: boolean;
    insufficientSunflowersMessage: string | null;
    isAvailableNow: boolean;
    isPlaceable: boolean;
    sunflowerPrice: number;
};

export function getHudEntityPlacementAvailability({
    accountSunflowers,
    block,
    isAccountLoading,
    isSandbox,
    timeOfDay,
}: {
    accountSunflowers: number | null | undefined;
    block: BlockData;
    isAccountLoading: boolean;
    isSandbox: boolean;
    timeOfDay: number;
}): HudEntityPlacementAvailability {
    const sunflowerPrice = block.prices.sunflowers ?? 0;
    const hasSunflowerPrice = sunflowerPrice > 0;
    const isAvailableNow =
        isSandbox ||
        !isNightOnlyBlockPurchase(block) ||
        isNightTimeOfDay(timeOfDay);
    const hasEnoughSunflowers =
        isSandbox ||
        !hasSunflowerPrice ||
        (typeof accountSunflowers === 'number' &&
            accountSunflowers >= sunflowerPrice);
    const isPlaceable = isSandbox || hasSunflowerPrice;
    const availabilityMessage =
        !isAvailableNow && hasSunflowerPrice ? 'Dostupno samo noću.' : null;
    const insufficientSunflowersMessage =
        !hasEnoughSunflowers &&
        !isAccountLoading &&
        typeof accountSunflowers === 'number'
            ? 'Nedovoljno suncokreta.'
            : null;

    return {
        availabilityMessage,
        canPlace: isPlaceable && isAvailableNow && hasEnoughSunflowers,
        hasEnoughSunflowers,
        hasSunflowerPrice,
        insufficientSunflowersMessage,
        isAvailableNow,
        isPlaceable,
        sunflowerPrice,
    };
}
