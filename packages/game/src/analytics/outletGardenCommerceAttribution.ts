const outletGardenCommerceAttributionKey =
    'gredice-outlet-garden-commerce-attribution-v1';

export type OutletGardenCommerceAttribution = {
    cartItemId: number;
    holdExpiresAt: string;
    outletOfferId: number;
};

type OutletCartItemForAttribution = {
    id: number;
    outlet?: {
        expired?: boolean;
        holdExpiresAt?: string | null;
        offerId?: number;
        status?: string;
    } | null;
};

function isPositiveSafeInteger(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}

function parseAttribution(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const cartItemId: unknown = Reflect.get(parsed, 'cartItemId');
        const holdExpiresAt: unknown = Reflect.get(parsed, 'holdExpiresAt');
        const outletOfferId: unknown = Reflect.get(parsed, 'outletOfferId');
        if (
            !isPositiveSafeInteger(cartItemId) ||
            !isPositiveSafeInteger(outletOfferId) ||
            typeof holdExpiresAt !== 'string' ||
            !Number.isFinite(new Date(holdExpiresAt).getTime())
        ) {
            return null;
        }

        return { cartItemId, holdExpiresAt, outletOfferId };
    } catch {
        return null;
    }
}

function storage() {
    return typeof window === 'undefined' ? null : window.sessionStorage;
}

export function hasOutletGardenCommerceAttribution() {
    try {
        return Boolean(storage()?.getItem(outletGardenCommerceAttributionKey));
    } catch {
        return false;
    }
}

export function storeOutletGardenCommerceAttribution(
    attribution: OutletGardenCommerceAttribution,
) {
    try {
        storage()?.setItem(
            outletGardenCommerceAttributionKey,
            JSON.stringify(attribution),
        );
    } catch {
        // Attribution is optional and must never block a reservation.
    }
}

export function clearOutletGardenCommerceAttribution() {
    try {
        storage()?.removeItem(outletGardenCommerceAttributionKey);
    } catch {
        // Session storage is optional.
    }
}

export function resolveOutletGardenCommerceAttribution(
    items: readonly OutletCartItemForAttribution[],
    now = Date.now(),
) {
    let value: string | null = null;
    try {
        value = storage()?.getItem(outletGardenCommerceAttributionKey) ?? null;
    } catch {
        return null;
    }

    const attribution = resolveOutletGardenCommerceAttributionValue(
        value,
        items,
        now,
    );
    if (!attribution) {
        clearOutletGardenCommerceAttribution();
    }
    return attribution;
}

export function resolveOutletGardenCommerceAttributionValue(
    value: string | null,
    items: readonly OutletCartItemForAttribution[],
    now = Date.now(),
) {
    const attribution = parseAttribution(value);

    if (!attribution || new Date(attribution.holdExpiresAt).getTime() <= now) {
        return null;
    }

    const item = items.find(
        (candidate) => candidate.id === attribution?.cartItemId,
    );
    if (
        !item?.outlet ||
        item.outlet.expired ||
        item.outlet.status !== 'held' ||
        item.outlet.offerId !== attribution.outletOfferId ||
        item.outlet.holdExpiresAt !== attribution.holdExpiresAt
    ) {
        return null;
    }

    return attribution;
}

export function consumeOutletGardenCommerceAttribution(
    items: readonly OutletCartItemForAttribution[],
    now = Date.now(),
) {
    const attribution = resolveOutletGardenCommerceAttribution(items, now);
    clearOutletGardenCommerceAttribution();
    return attribution;
}
