import { Checkbox } from '@gredice/ui/Checkbox';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Inputs/Checkbox',
    component: Checkbox,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Checkbox uses Base UI while preserving Gredice labels, read-only behavior, native form values, and indeterminate state.',
            },
        },
    },
    args: {
        label: 'Ukljuci obavijesti',
    },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
    args: {
        defaultChecked: true,
        label: 'Automatski potvrdi zadatak',
    },
};

export const Disabled: Story = {
    args: {
        disabled: true,
        label: 'Nedostupna opcija',
    },
};

export const ReadOnly: Story = {
    args: {
        defaultChecked: true,
        label: 'Zakljucana postavka',
        readOnly: true,
    },
};

export const Indeterminate: Story = {
    args: {
        checked: 'indeterminate',
        label: 'Djelomično odabrane gredice',
    },
};

export const NativeFormValue: Story = {
    render: () => (
        <form className="space-y-3">
            <Checkbox
                defaultChecked
                label="Uključi u izvještaj"
                name="report"
                value="included"
            />
            <button
                className="rounded-md border border-border px-3 py-1.5 text-sm"
                type="submit"
            >
                Pošalji
            </button>
        </form>
    ),
};

export const Circle: Story = {
    args: {
        defaultChecked: true,
        label: 'Zadatak je dovrsen',
        readOnly: true,
        variant: 'circle',
    },
};

export const WithoutIcon: Story = {
    args: {
        defaultChecked: true,
        disableIcon: true,
        label: 'Samo stanje kontrole',
    },
};
