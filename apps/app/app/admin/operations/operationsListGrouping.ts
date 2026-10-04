import { timeZoneDayKey, unknownDayKey } from '@gredice/js/dates';
import { croatianDayLabel, croatianPlural } from '@gredice/js/i18n';
import type {
    OperationsListOperation,
    OperationsListOperationDefinition,
    OperationsListSortKey,
} from './operationsListTypes';

/**
 * Operations are grouped by the farm calendar day, not by the viewer timezone,
 * so the server and the client always render the same groups.
 */
export const operationsListTimeZone = 'Europe/Zagreb';

export const operationsListDayBubbleLimit = 6;

export type OperationsListDayBubble = {
    key: string;
    count: number;
    kind: OperationsListOperation['kind'];
    label: string;
    operationDefinition: OperationsListOperationDefinition;
};

export type OperationsListDayBubbles = {
    bubbles: OperationsListDayBubble[];
    overflowCount: number;
};

export type OperationsListDayCounts = {
    operations: number;
    sowings: number;
    total: number;
};

export type OperationsListDayGroup = {
    dayKey: string;
    operations: OperationsListOperation[];
};

export const unknownOperationsListDayKey = unknownDayKey;

export function operationsListDayKey(value: Date | string | null | undefined) {
    return timeZoneDayKey(value, operationsListTimeZone);
}

export function operationsListSortDate(
    operation: OperationsListOperation,
    sortKey: OperationsListSortKey,
) {
    return sortKey === 'createdAt' ? operation.createdAt : operation.timestamp;
}

export function isOperationsListGroupedSortKey(sortKey: OperationsListSortKey) {
    return sortKey === 'date' || sortKey === 'createdAt';
}

export function groupOperationsByDay(
    operations: OperationsListOperation[],
    sortKey: OperationsListSortKey,
): OperationsListDayGroup[] {
    const groups: OperationsListDayGroup[] = [];
    const groupsByKey = new Map<string, OperationsListDayGroup>();

    for (const operation of operations) {
        const dayKey = operationsListDayKey(
            operationsListSortDate(operation, sortKey),
        );
        const existingGroup = groupsByKey.get(dayKey);

        if (existingGroup) {
            existingGroup.operations.push(operation);
            continue;
        }

        const group: OperationsListDayGroup = {
            dayKey,
            operations: [operation],
        };
        groupsByKey.set(dayKey, group);
        groups.push(group);
    }

    return groups;
}

export function operationsListDayCounts(
    operations: OperationsListOperation[],
): OperationsListDayCounts {
    const sowings = operations.filter(
        (operation) => operation.kind === 'sowing',
    ).length;

    return {
        operations: operations.length - sowings,
        sowings,
        total: operations.length,
    };
}

export function operationsListDayBubbles(
    operations: OperationsListOperation[],
    limit = operationsListDayBubbleLimit,
): OperationsListDayBubbles {
    const bubbles: OperationsListDayBubble[] = [];
    const bubblesByKey = new Map<string, OperationsListDayBubble>();

    for (const operation of operations) {
        const key = `${operation.kind}:${operation.label}`;
        const existingBubble = bubblesByKey.get(key);

        if (existingBubble) {
            existingBubble.count += 1;
            continue;
        }

        const bubble: OperationsListDayBubble = {
            key,
            count: 1,
            kind: operation.kind,
            label: operation.label,
            operationDefinition: operation.operationDefinition,
        };
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

export function operationsListDayCountsLabel(counts: OperationsListDayCounts) {
    const labels: string[] = [];

    if (counts.operations > 0 || counts.sowings === 0) {
        labels.push(
            `${counts.operations} ${croatianPlural(counts.operations, {
                one: 'radnja',
                few: 'radnje',
                many: 'radnji',
            })}`,
        );
    }

    if (counts.sowings > 0) {
        labels.push(
            `${counts.sowings} ${croatianPlural(counts.sowings, {
                one: 'sjetva',
                few: 'sjetve',
                many: 'sjetvi',
            })}`,
        );
    }

    return labels.join(' · ');
}

export function operationsListDayLabel(dayKey: string, currentYear?: number) {
    return croatianDayLabel(dayKey, currentYear);
}
