'use client';

import type {
    AutomationDefinitionStatus,
    AutomationRunStatus,
} from '@gredice/storage';
import { FilterInput } from '@gredice/ui/FilterInput';
import { TableFilter } from '../../../components/shared/filters';
import {
    automationDefinitionStatusFilterOption,
    automationRunStatusFilterOption,
} from './automationFilterOptions';

export function AutomationFilters({
    definitionStatuses,
    runStatuses,
}: {
    definitionStatuses: AutomationDefinitionStatus[];
    runStatuses: AutomationRunStatus[];
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TableFilter
                filters={[
                    automationDefinitionStatusFilterOption(definitionStatuses),
                    automationRunStatusFilterOption(runStatuses),
                ]}
                defaultValues={{
                    status: 'enabled',
                    runStatus: 'withoutSkipped',
                }}
                className="flex"
            />
            <FilterInput
                searchParamName="triggerEventType"
                fieldName="triggerEventType"
                instant
                className="sm:ml-auto"
            />
        </div>
    );
}
