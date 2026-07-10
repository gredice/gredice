'use client';

import { Row } from '@gredice/ui/Row';
import {
    type FilterOption,
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '../../../components/shared/filters';
import { OperationEntityMultiSelectFilter } from './OperationEntityMultiSelectFilter';
import { operationsListRecordTypeParam } from './operationsListQuery';
import type { OperationEntityFilterOption } from './operationsListTypes';

const OPERATIONS_RECORD_TYPE_FILTER_OPTIONS: FilterOption = {
    key: operationsListRecordTypeParam,
    label: 'Vrsta zapisa',
    activeLabel: 'Vrsta',
    options: [
        { value: '', label: 'Svi zapisi' },
        { value: 'operation', label: 'Radnje' },
        { value: 'sowing', label: 'Sijanje' },
    ],
};

const OPERATIONS_FILTER_OPTIONS = [
    TIME_FILTER_OPTIONS,
    OPERATIONS_RECORD_TYPE_FILTER_OPTIONS,
];

export function OperationsFilters({
    operationOptions,
    selectedOperationEntityIds,
}: {
    operationOptions: OperationEntityFilterOption[];
    selectedOperationEntityIds: number[];
}) {
    return (
        <Row spacing={2} className="flex-wrap">
            <TableFilter
                filters={OPERATIONS_FILTER_OPTIONS}
                defaultValues={{ from: 'last-14-days', type: '' }}
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
