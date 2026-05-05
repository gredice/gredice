import {
    type FilterOption,
    TableFilter,
    TIME_FILTER_OPTIONS,
} from '@gredice/ui/TableFilter';
import { Filter, User } from '@signalco/ui-icons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useMemo, useState } from 'react';

function ControlledTableFilter({ filters }: { filters: FilterOption[] }) {
    const [currentFilters, setCurrentFilters] = useState<
        Record<string, string>
    >({});

    const onFilterChange = (key: string, value: string) => {
        setCurrentFilters((prev) => {
            if (!value || value === 'all') {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [key]: value };
        });
    };

    const onClearAll = () => setCurrentFilters({});

    const activeFiltersText = useMemo(
        () => JSON.stringify(currentFilters, null, 2),
        [currentFilters],
    );

    return (
        <div className="space-y-4">
            <TableFilter
                filters={filters}
                currentFilters={currentFilters}
                onFilterChange={onFilterChange}
                onClearAll={onClearAll}
            />
            <pre className="rounded-md border p-3 text-xs">
                {activeFiltersText}
            </pre>
        </div>
    );
}

const meta = {
    title: 'packages/ui/TableFilter',
    component: ControlledTableFilter,
} satisfies Meta<typeof ControlledTableFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TimeOnly: Story = {
    args: {
        filters: [TIME_FILTER_OPTIONS],
    },
};

export const MultipleFilters: Story = {
    args: {
        filters: [
            TIME_FILTER_OPTIONS,
            {
                key: 'status',
                label: 'Status',
                icon: <Filter className="size-4" />,
                options: [
                    { value: '', label: 'Svi statusi' },
                    { value: 'pending', label: 'Na čekanju' },
                    { value: 'approved', label: 'Odobreno' },
                    { value: 'archived', label: 'Arhivirano' },
                ],
            },
            {
                key: 'assignee',
                label: 'Dodijeljeno',
                icon: <User className="size-4" />,
                options: [
                    { value: '', label: 'Svi korisnici' },
                    { value: '1', label: 'Ana' },
                    { value: '2', label: 'Marko' },
                    { value: '3', label: 'Petra' },
                ],
            },
        ],
    },
};
