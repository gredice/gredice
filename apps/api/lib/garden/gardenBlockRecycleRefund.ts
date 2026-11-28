/**
 * The one refund rule for recycling an ordinary (non-pack) garden block.
 * Both refund paths use it: DELETE `/gardens/:id/blocks/:blockId`
 * (`gardenBlockMutationService`) and the PATCH `/stacks` remove operation
 * (`gardenStacksPatchPlanner` + `gardenStacksPatchService`).
 *
 * - Sandbox gardens never move Sunflowers.
 * - Blocks with a stored `paidSunflowers` refund exactly that amount (0 for
 *   free blocks), whatever the directory price is today.
 * - Legacy blocks (no stored price) keep the old rule, the current directory
 *   price or 10 when it is missing or 0, capped by the exact paid price
 *   recovered from purchase records when one exists.
 */
export const gardenBlockRecycleFallbackSunflowers = 10;
const maximumStorageInteger = 2_147_483_647;

export type GardenBlockRecycleRefundBasis =
    | 'sandbox'
    | 'paid-price'
    | 'purchase-record'
    | 'directory-price'
    | 'fallback';

export type GardenBlockRecycleRefund = Readonly<{
    basis: GardenBlockRecycleRefundBasis;
    sunflowers: number;
}>;

export type GardenBlockRecycleRefundInput = Readonly<{
    directoryPrice: number | null | undefined;
    isSandbox: boolean;
    paidSunflowers: number | null | undefined;
}>;

export type GardenBlockRecycleRefundResult =
    | Readonly<{ ok: true; refund: GardenBlockRecycleRefund }>
    | Readonly<{
          ok: false;
          reason: 'invalid-directory-price' | 'invalid-paid-price';
      }>;

function isStoredSunflowerAmount(value: number) {
    return (
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= maximumStorageInteger
    );
}

export function resolveGardenBlockRecycleRefund({
    directoryPrice,
    isSandbox,
    paidSunflowers,
}: GardenBlockRecycleRefundInput): GardenBlockRecycleRefundResult {
    if (isSandbox) {
        return { ok: true, refund: { basis: 'sandbox', sunflowers: 0 } };
    }
    if (paidSunflowers !== null && paidSunflowers !== undefined) {
        if (!isStoredSunflowerAmount(paidSunflowers)) {
            return { ok: false, reason: 'invalid-paid-price' };
        }
        return {
            ok: true,
            refund: { basis: 'paid-price', sunflowers: paidSunflowers },
        };
    }
    if (typeof directoryPrice === 'number' && directoryPrice > 0) {
        if (!isStoredSunflowerAmount(directoryPrice)) {
            return { ok: false, reason: 'invalid-directory-price' };
        }
        return {
            ok: true,
            refund: { basis: 'directory-price', sunflowers: directoryPrice },
        };
    }
    return {
        ok: true,
        refund: {
            basis: 'fallback',
            sunflowers: gardenBlockRecycleFallbackSunflowers,
        },
    };
}

/** True when the refund still depends on today's price (a legacy block). */
export function isLegacyGardenBlockRecycleRefund(
    refund: GardenBlockRecycleRefund,
) {
    return refund.basis === 'directory-price' || refund.basis === 'fallback';
}

/**
 * Legacy blocks refund min(current refund, recovered paid price). A missing
 * or malformed recovered price leaves the legacy refund unchanged.
 */
export function capLegacyGardenBlockRecycleRefund(
    refund: GardenBlockRecycleRefund,
    recoveredPaidSunflowers: number | null,
): GardenBlockRecycleRefund {
    if (
        !isLegacyGardenBlockRecycleRefund(refund) ||
        recoveredPaidSunflowers === null ||
        !isStoredSunflowerAmount(recoveredPaidSunflowers) ||
        recoveredPaidSunflowers >= refund.sunflowers
    ) {
        return refund;
    }
    return { basis: 'purchase-record', sunflowers: recoveredPaidSunflowers };
}
