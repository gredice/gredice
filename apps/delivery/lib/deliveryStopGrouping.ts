export function buildDeliveryStopKey(slotId: number, formattedAddress: string) {
    const normalizedAddress = formattedAddress
        .normalize('NFKC')
        .toLocaleLowerCase('hr-HR')
        .replace(/\s*,\s*/g, ',')
        .replace(/\s+/g, ' ')
        .trim();

    return `${slotId}:${normalizedAddress}`;
}

export function groupByDeliveryStop<T extends { stopKey: string }>(
    items: readonly T[],
) {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const group = groups.get(item.stopKey);
        if (group) {
            group.push(item);
        } else {
            groups.set(item.stopKey, [item]);
        }
    }

    return Array.from(groups, ([stopKey, groupedItems]) => ({
        stopKey,
        items: groupedItems,
    }));
}
