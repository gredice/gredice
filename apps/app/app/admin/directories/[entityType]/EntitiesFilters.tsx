'use client';

import { Check, Edit, Megaphone, Warning } from '@gredice/ui/icons';
import {
    type FilterOption,
    TableFilter,
} from '../../../../components/shared/filters';

const COMPLETION_FILTER_OPTIONS: FilterOption = {
    key: 'completion',
    label: 'Ispunjenost',
    icon: <Check className="size-4" />,
    options: [
        { value: '', label: 'Svi zapisi' },
        {
            value: 'complete',
            label: 'Ispunjeni',
            icon: <Check className="size-4" />,
        },
        {
            value: 'incomplete',
            label: 'Nepotpuni',
            icon: <Warning className="size-4" />,
        },
    ],
};

const PUBLISH_STATE_FILTER_OPTIONS: FilterOption = {
    key: 'state',
    label: 'Status objave',
    icon: <Megaphone className="size-4" />,
    options: [
        { value: '', label: 'Svi statusi' },
        {
            value: 'draft',
            label: 'Draft',
            icon: <Edit className="size-4" />,
        },
        {
            value: 'published',
            label: 'Objavljeno',
            icon: <Megaphone className="size-4" />,
        },
    ],
};

export function EntitiesFilters() {
    return (
        <TableFilter
            filters={[COMPLETION_FILTER_OPTIONS, PUBLISH_STATE_FILTER_OPTIONS]}
            defaultValues={{
                completion: '',
                state: '',
            }}
            className="flex"
        />
    );
}
