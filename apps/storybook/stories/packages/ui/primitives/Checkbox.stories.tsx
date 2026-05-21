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
                    'Checkbox wraps the Radix checkbox primitive with Signalco-compatible label, readOnly, and icon behavior.',
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

export const WithoutIcon: Story = {
    args: {
        defaultChecked: true,
        disableIcon: true,
        label: 'Samo stanje kontrole',
    },
};
