'use client';

import { Check, FileText, Hourglass, User } from '@gredice/ui/icons';
import {
    type FilterOption,
    TableFilter,
} from '../../../components/shared/filters';
import {
    AGE_OPTIONS,
    ageLabel,
    ENTITY_TYPE_OPTIONS,
    entityTypeLabel,
    STATUS_OPTIONS,
    statusLabel,
} from './communityEditLabels';

export type CommunityEditSubmitterFilterOption = {
    value: string;
    label: string;
};

type CommunityEditsFiltersProps = {
    submitters: CommunityEditSubmitterFilterOption[];
};

const STATUS_FILTER_OPTIONS: FilterOption = {
    key: 'status',
    label: 'Status',
    icon: <Check className="size-4" />,
    options: [
        { value: '', label: 'Svi statusi' },
        ...STATUS_OPTIONS.filter((status) => status !== 'all').map(
            (status) => ({
                value: status,
                label: statusLabel(status),
            }),
        ),
    ],
};

const ENTITY_TYPE_FILTER_OPTIONS: FilterOption = {
    key: 'entityType',
    label: 'Tip zapisa',
    icon: <FileText className="size-4" />,
    options: [
        { value: '', label: 'Svi zapisi' },
        ...ENTITY_TYPE_OPTIONS.filter((entityType) => entityType !== 'all').map(
            (entityType) => ({
                value: entityType,
                label: entityTypeLabel(entityType),
            }),
        ),
    ],
};

const AGE_FILTER_OPTIONS: FilterOption = {
    key: 'age',
    label: 'Dob',
    icon: <Hourglass className="size-4" />,
    options: [
        { value: '', label: ageLabel('all') },
        ...AGE_OPTIONS.filter((age) => age !== 'all').map((age) => ({
            value: age,
            label: ageLabel(age),
        })),
    ],
};

export function CommunityEditsFilters({
    submitters,
}: CommunityEditsFiltersProps) {
    const submitterFilterOptions: FilterOption = {
        key: 'submitter',
        label: 'Pošiljatelj',
        icon: <User className="size-4" />,
        options: [{ value: '', label: 'Svi pošiljatelji' }, ...submitters],
    };

    return (
        <TableFilter
            filters={[
                STATUS_FILTER_OPTIONS,
                ENTITY_TYPE_FILTER_OPTIONS,
                AGE_FILTER_OPTIONS,
                submitterFilterOptions,
            ]}
            defaultValues={{
                status: '',
                entityType: '',
                age: '',
                submitter: '',
            }}
            className="flex"
        />
    );
}
