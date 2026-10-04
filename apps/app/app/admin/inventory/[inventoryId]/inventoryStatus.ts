export type InventoryStateFilter = 'ok' | 'warning' | 'critical';

type InventoryStatusItem = {
    quantity: number;
    lowCountThreshold: number | null;
};

export function getInventoryItemState(
    item: InventoryStatusItem,
    defaultLowCountThreshold: number | null = null,
): InventoryStateFilter {
    const minimumQuantity = item.lowCountThreshold ?? defaultLowCountThreshold;

    if (item.quantity === 0) {
        return 'critical';
    }

    if (minimumQuantity !== null && item.quantity <= minimumQuantity) {
        return 'warning';
    }

    return 'ok';
}

export function normalizeInventoryStateFilter(
    value: string,
): InventoryStateFilter | '' {
    if (value === 'ok' || value === 'warning') {
        return value;
    }

    if (value === 'critical' || value === 'error') {
        return 'critical';
    }

    return '';
}

export type InventoryLinkFilter = 'orphaned';

type InventoryLinkItem = {
    entityId: number | null;
    entity: { isDeleted: boolean } | null;
};

/**
 * An inventory item is orphaned when it still references an entity that is no
 * longer available - either soft-deleted in the directory or gone entirely.
 * Deleting an entity intentionally leaves the inventory item untouched, so the
 * inventory keeps its count and can be re-linked later.
 */
export function isInventoryItemOrphaned(item: InventoryLinkItem) {
    if (item.entityId === null) {
        return false;
    }

    return item.entity === null || item.entity.isDeleted;
}

export function normalizeInventoryLinkFilter(
    value: string,
): InventoryLinkFilter | '' {
    return value === 'orphaned' ? 'orphaned' : '';
}
