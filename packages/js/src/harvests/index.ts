export const HARVEST_LABEL_FIELD_LIMIT = 9;

const harvestDayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zagreb',
});

export function getHarvestDayKey(date: Date) {
    return harvestDayFormatter.format(date);
}

/** Keep each run within one harvest context and split at gaps or nine fields. */
export function groupConsecutiveHarvestFields<
    T extends { groupKey: string; position: number },
>(fields: T[]): T[][] {
    const groups: T[][] = [];
    const byContext = new Map<string, T[]>();
    for (const field of fields) {
        const context = byContext.get(field.groupKey) ?? [];
        context.push(field);
        byContext.set(field.groupKey, context);
    }
    for (const context of byContext.values()) {
        let group: T[] = [];
        for (const field of context.toSorted(
            (a, b) => a.position - b.position,
        )) {
            const previous = group.at(-1);
            if (
                previous &&
                (field.position !== previous.position + 1 ||
                    group.length === HARVEST_LABEL_FIELD_LIMIT)
            ) {
                groups.push(group);
                group = [];
            }
            group.push(field);
        }
        if (group.length) groups.push(group);
    }
    return groups;
}
