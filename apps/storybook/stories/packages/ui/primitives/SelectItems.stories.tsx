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
        args.defaultValue as string | undefined,
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
