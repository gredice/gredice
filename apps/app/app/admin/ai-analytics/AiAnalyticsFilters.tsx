'use client';

import { AI } from '@gredice/ui/icons';
import {
    type FilterOption,
    TableFilter,
} from '../../../components/shared/filters';
import { aiAnalyticsOperationTypeOptions } from './aiAnalyticsPresentation';

const AI_OPERATION_TYPE_FILTER_OPTIONS: FilterOption = {
    key: 'type',
    label: 'Tip AI operacije',
    icon: <AI className="size-4" />,
    options: [
        { value: '', label: 'Sve AI operacije' },
        ...aiAnalyticsOperationTypeOptions,
    ],
};

export function AiAnalyticsFilters() {
    return (
        <TableFilter
            filters={[AI_OPERATION_TYPE_FILTER_OPTIONS]}
            defaultValues={{ type: '' }}
            className="flex"
        />
    );
}
