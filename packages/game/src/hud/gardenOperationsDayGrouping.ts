import { timeZoneDayKey } from '@gredice/js/dates';
import { croatianDayLabel, croatianPlural } from '@gredice/js/i18n';
import {
    getOperationOrderingTime,
    type OperationOrderingItem,
} from './gardenOperationOrdering';

/**
 * Operations are grouped by the garden's calendar day rather than the viewer's,
 * so a day never splits in two for someone travelling.
 */
export const gardenOperationsTimeZone = 'Europe/Zagreb';

export const gardenOperationsDayBubbleLimit = 6;

export type GardenOperationKind = 'operation' | 'planting';

export type GardenOperationsDayGroup<TOperation> = {
    dayKey: string;
    operations: TOperation[];
};

export type GardenOperationsDayCounts = {
    operations: number;
    plantings: number;
    total: number;
};

export type GardenOperationsDayBubbleItem = {
    kind: GardenOperationKind;
    label: string;
};

export type GardenOperationsDayBubble<
    TItem extends GardenOperationsDayBubbleItem,
> = TItem & {
    key: string;
    count: number;
};

export type GardenOperationsDayBubbles<
    TItem extends GardenOperationsDayBubbleItem,
> = {
    bubbles: GardenOperationsDayBubble<TItem>[];
    overflowCount: number;
};

export function gardenOperationDayKey(operation: OperationOrderingItem) {
    const orderingTime = getOperationOrderingTime(operation);

    return timeZoneDayKey(
        orderingTime > 0 ? orderingTime : null,
        gardenOperationsTimeZone,
    );
}

export function gardenOperationsDayLabel(dayKey: string, currentYear?: number) {
    return croatianDayLabel(dayKey, currentYear);
}

/**
 * Groups an already sorted list, keeping both the day order and the order of
 * the operations inside each day.
 */
export function groupGardenOperationsByDay<
    TOperation extends OperationOrderingItem,
>(operations: TOperation[]): GardenOperationsDayGroup<TOperation>[] {
    const groups: GardenOperationsDayGroup<TOperation>[] = [];
    const groupsByKey = new Map<string, GardenOperationsDayGroup<TOperation>>();

    for (const operation of operations) {
        const dayKey = gardenOperationDayKey(operation);
        const existingGroup = groupsByKey.get(dayKey);

        if (existingGroup) {
            existingGroup.operations.push(operation);
            continue;
        }

        const group: GardenOperationsDayGroup<TOperation> = {
            dayKey,
            operations: [operation],
        };
        groupsByKey.set(dayKey, group);
        groups.push(group);
    }

    return groups;
}

export function gardenOperationsDayCounts(
    items: GardenOperationsDayBubbleItem[],
): GardenOperationsDayCounts {
    const plantings = items.filter((item) => item.kind === 'planting').length;

    return {
        operations: items.length - plantings,
        plantings,
        total: items.length,
    };
}

export function gardenOperationsDayCountsLabel(
    counts: GardenOperationsDayCounts,
) {
    const labels: string[] = [];

    if (counts.operations > 0 || counts.plantings === 0) {
        labels.push(
            `${counts.operations} ${croatianPlural(counts.operations, {
                one: 'radnja',
                few: 'radnje',
                many: 'radnji',
            })}`,
        );
    }

    if (counts.plantings > 0) {
        labels.push(
            `${counts.plantings} ${croatianPlural(counts.plantings, {
                one: 'sadnja',
                few: 'sadnje',
                many: 'sadnji',
            })}`,
        );
    }

    return labels.join(' · ');
}

/**
 * Collapses a day into one bubble per distinct operation, biggest first, with
 * everything past `limit` reported as an overflow count.
 */
export function gardenOperationsDayBubbles<
    TItem extends GardenOperationsDayBubbleItem,
>(
    items: TItem[],
    limit = gardenOperationsDayBubbleLimit,
): GardenOperationsDayBubbles<TItem> {
    const bubbles: GardenOperationsDayBubble<TItem>[] = [];
    const bubblesByKey = new Map<string, GardenOperationsDayBubble<TItem>>();

    for (const item of items) {
        const key = `${item.kind}:${item.label}`;
        const existingBubble = bubblesByKey.get(key);

        if (existingBubble) {
            existingBubble.count += 1;
            continue;
        }

        const bubble = { ...item, key, count: 1 };
        bubblesByKey.set(key, bubble);
        bubbles.push(bubble);
    }

    const sortedBubbles = bubbles.toSorted(
        (left, right) =>
            right.count - left.count ||
            left.label.localeCompare(right.label, 'hr', {
                numeric: true,
                sensitivity: 'base',
            }),
    );
    const visibleBubbles = sortedBubbles.slice(0, Math.max(limit, 0));
    const overflowCount = sortedBubbles
        .slice(visibleBubbles.length)
        .reduce((total, bubble) => total + bubble.count, 0);

    return { bubbles: visibleBubbles, overflowCount };
}
