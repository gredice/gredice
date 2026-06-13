import {
    type AutomationRunStatus,
    automationRunStatusValues,
} from '@gredice/storage';

export type AutomationRunStatusFilter =
    | 'withoutSkipped'
    | 'all'
    | AutomationRunStatus;

export function normalizeAutomationRunStatusFilter(
    value: string | undefined,
): AutomationRunStatusFilter {
    if (value === 'all' || value === 'withoutSkipped') {
        return value;
    }

    const status = automationRunStatusValues.find(
        (candidate) => candidate === value,
    );

    return status ?? 'withoutSkipped';
}

export function statusesForAutomationRunFilter(
    filter: AutomationRunStatusFilter,
): AutomationRunStatus | AutomationRunStatus[] | undefined {
    if (filter === 'all') {
        return undefined;
    }

    if (filter === 'withoutSkipped') {
        return automationRunStatusValues.filter(
            (status) => status !== 'skipped',
        );
    }

    return filter;
}
