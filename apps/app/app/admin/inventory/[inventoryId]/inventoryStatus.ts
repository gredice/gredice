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
