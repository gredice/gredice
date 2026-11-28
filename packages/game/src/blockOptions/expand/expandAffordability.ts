import { blockExpandCopy } from '../blockOptionsCopy';

export type ExpandAffordabilityInput = {
    /** Copies the plan would place. */
    count: number;
    /** Directory price of one copy. */
    unitPrice: number;
    /**
     * The balance the HUD shows: the account balance minus the shopping
     * cart (OPEN-4), so Expand never spends sunflowers the cart expects at
     * checkout. Null or undefined while it is not known.
     */
    balance: number | null | undefined;
    /** Sandbox gardens build for free. */
    isSandbox: boolean;
    /** The account or the cart is still loading. */
    isAccountLoading: boolean;
    /** False for a night-only block by day. */
    isAvailableNow: boolean;
    /** False for a block with no price outside a sandbox (not for sale). */
    isPlaceable: boolean;
    /** A confirmed batch is in flight. */
    pending?: boolean;
};

export type ExpandAffordability = {
    /** Sunflowers the copies cost together (0 in a sandbox). */
    total: number;
    /** How many copies the balance covers (every copy in a sandbox). */
    affordableCount: number;
    /** The balance covers every copy. */
    canAfford: boolean;
    canConfirm: boolean;
    /** Why the block cannot be bought now, or why the balance is short. */
    statusMessage: string | null;
};

function toCount(value: number) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Cost and affordability of an Expand plan. The disabled confirm is only a
 * hint: the server checks the price, the availability and the raw balance
 * again and rejects what does not fit.
 */
export function resolveExpandAffordability(
    input: ExpandAffordabilityInput,
): ExpandAffordability {
    const count = toCount(input.count);
    const unitPrice = input.isSandbox ? 0 : toCount(input.unitPrice);
    const total = count * unitPrice;
    const balance =
        typeof input.balance === 'number' && Number.isFinite(input.balance)
            ? input.balance
            : null;
    const affordableCount =
        input.isSandbox || unitPrice === 0
            ? count
            : balance === null
              ? 0
              : Math.max(0, Math.floor(balance / unitPrice));
    const canAfford = input.isSandbox || (balance !== null && balance >= total);
    const canConfirm =
        count > 0 &&
        input.isPlaceable &&
        input.isAvailableNow &&
        !input.isAccountLoading &&
        canAfford &&
        !input.pending;

    let statusMessage: string | null = null;
    if (!input.isPlaceable) {
        statusMessage = blockExpandCopy.notForSale;
    } else if (!input.isAvailableNow) {
        statusMessage = blockExpandCopy.nightOnly;
    } else if (
        count > 0 &&
        !canAfford &&
        !input.isAccountLoading &&
        balance !== null
    ) {
        statusMessage = blockExpandCopy.short(Math.min(affordableCount, count));
    }

    return { total, affordableCount, canAfford, canConfirm, statusMessage };
}

/**
 * The bar's one status line. Reasons the block cannot be bought come first,
 * then an empty or fully skipped rectangle, then a short balance, then the
 * size cap once the rectangle reaches it.
 */
export function resolveExpandStatusMessage({
    affordability,
    count,
    depth,
    maxSide,
    width,
}: {
    affordability: Pick<ExpandAffordability, 'statusMessage'>;
    count: number;
    width: number;
    depth: number;
    maxSide: number;
}) {
    if (
        affordability.statusMessage === blockExpandCopy.notForSale ||
        affordability.statusMessage === blockExpandCopy.nightOnly
    ) {
        return affordability.statusMessage;
    }
    if (count <= 0) {
        return width * depth <= 1
            ? blockExpandCopy.empty
            : blockExpandCopy.allSkipped;
    }
    if (affordability.statusMessage) {
        return affordability.statusMessage;
    }
    if (width >= maxSide || depth >= maxSide) {
        return blockExpandCopy.cap(maxSide);
    }

    return null;
}

/**
 * Whether the bar's status line already says what an alert says: the same
 * text, or the same sentence with more detail. A confirm the server turned
 * down for a short balance alerts "Nedovoljno suncokreta."; once the
 * account refreshes, the status adds how many blocks the HUD balance covers,
 * and the alert would only repeat it.
 */
export function isExpandAlertInStatus(alert: string, status: string | null) {
    return status?.startsWith(alert) ?? false;
}
