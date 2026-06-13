'use client';

import type { AutomationRunStatus } from '@gredice/storage';
import { TableFilter } from '../../../components/shared/filters';
import { automationRunStatusFilterOption } from './automationFilterOptions';

export function AutomationRunStatusFilter({
    statusOptions,
}: {
    statusOptions: AutomationRunStatus[];
}) {
    return (
        <TableFilter
            filters={[automationRunStatusFilterOption(statusOptions)]}
            defaultValues={{ runStatus: 'withoutSkipped' }}
            className="flex"
        />
    );
}
