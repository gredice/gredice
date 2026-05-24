import { Leaf, Settings, Truck } from '@gredice/ui/icons';
import { SelectItems } from '@gredice/ui/SelectItems';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ComponentProps, useState } from 'react';

const meta = {
    title: 'packages/ui/Forms/SelectItems',
    component: SelectItems,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'SelectItems provides a Radix Select-backed compatibility primitive for choosing one value from a compact option list.',
            },
        },
    },
    args: {
        label: 'Status',
        placeholder: 'Odaberi status',
        items: [
            { value: 'all', label: 'Svi statusi' },
            { value: 'active', label: 'Aktivno' },
            { value: 'paused', label: 'Pauzirano' },
            { value: 'archived', label: 'Arhivirano', disabled: true },
        ],
    },
    render: (args) => <ControlledSelect {...args} />,
} satisfies Meta<typeof SelectItems>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Plain: Story = {
    args: {
        variant: 'plain',
    },
};

export const WithIcons: Story = {
    args: {
        label: 'Podrucje',
        items: [
            {
                value: 'plants',
                label: 'Biljke',
                icon: <Leaf className="size-4" />,
            },
            {
                value: 'delivery',
                label: 'Dostava',
                icon: <Truck className="size-4" />,
            },
            {
                value: 'settings',
                label: 'Postavke',
                icon: <Settings className="size-4" />,
            },
        ],
    },
};

const plantSortItems = [
    { value: 'rajcica', label: 'Rajčica' },
    { value: 'paprika', label: 'Paprika' },
    { value: 'krastavac', label: 'Krastavac' },
    { value: 'salata', label: 'Salata' },
    { value: 'mrkva', label: 'Mrkva' },
    { value: 'blitva', label: 'Blitva' },
    { value: 'tikvica', label: 'Tikvica' },
    { value: 'bosiljak', label: 'Bosiljak' },
];

export const SearchableList: Story = {
    args: {
        label: 'Biljka',
        placeholder: 'Odaberi biljku',
        items: plantSortItems,
    },
};

export const ServerFilteredList: Story = {
    args: {
        label: 'Račun',
        placeholder: 'Odaberi račun',
        clientSideFilter: false,
        searchPlaceholder: 'Pretraži račune...',
        items: plantSortItems.slice(0, 5),
    },
    render: (args) => <ServerFilteredSelect {...args} />,
};

export const EmptyStringValue: Story = {
    args: {
        defaultValue: '',
        items: [
            { value: '', label: 'Sve vrijednosti' },
            { value: 'scheduled', label: 'Zakazano' },
            { value: 'completed', label: 'Dovrseno' },
        ],
    },
};

export const HelperText: Story = {
    args: {
        helperText: 'Odaberi jednu vrijednost prije spremanja.',
    },
};

function ControlledSelect(args: ComponentProps<typeof SelectItems>) {
    const [value, setValue] = useState<string | undefined>(
        defaultStringValue(args.defaultValue),
    );

    return (
        <div className="w-80">
            <SelectItems
                {...args}
                value={value}
                onValueChange={(nextValue) => setValue(nextValue)}
            />
        </div>
    );
}

function ServerFilteredSelect(args: ComponentProps<typeof SelectItems>) {
    const [value, setValue] = useState<string | undefined>(
        defaultStringValue(args.defaultValue),
    );
    const [search, setSearch] = useState('');
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filteredItems = plantSortItems
        .filter((item) =>
            item.label.toLocaleLowerCase().includes(normalizedSearch),
        )
        .slice(0, 5);

    return (
        <div className="w-80">
            <SelectItems
                {...args}
                items={filteredItems}
                searchValue={search}
                value={value}
                onSearchValueChange={setSearch}
                onValueChange={(nextValue) => setValue(nextValue)}
            />
        </div>
    );
}

function defaultStringValue(value: unknown) {
    return typeof value === 'string' ? value : undefined;
}
