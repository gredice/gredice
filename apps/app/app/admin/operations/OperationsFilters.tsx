'use client';

import { Row } from '@gredice/ui/Row';
import {
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../components/shared/filters';
import { OperationEntityMultiSelectFilter } from './OperationEntityMultiSelectFilter';
import type { OperationEntityFilterOption } from './operationsListTypes';

export function OperationsFilters({
    operationOptions,
    selectedOperationEntityIds,
}: {
    operationOptions: OperationEntityFilterOption[];
    selectedOperationEntityIds: number[];
}) {
    const filters = [TIME_FILTER_OPTIONS];

    return (
        <Row spacing={2} className="flex-wrap">
            <TableFilter
                filters={filters}
                defaultValues={{ from: 'last-14-days' }}
                className="flex"
            />
            {operationOptions.length ? (
                <OperationEntityMultiSelectFilter
                    options={operationOptions}
                    selectedOperationEntityIds={selectedOperationEntityIds}
                />
            ) : null}
        </Row>
    );
}
