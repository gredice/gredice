import { Switch } from '@gredice/ui/Switch';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Inputs/Switch',
    component: Switch,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Switch provides the shared binary on/off control for settings that take effect immediately.',
            },
        },
    },
    args: {
        label: 'Ukljuci obavijesti',
    },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
    args: {
        defaultChecked: true,
        label: 'Prikazi widget',
    },
};

export const Disabled: Story = {
    args: {
        disabled: true,
        label: 'Nedostupna postavka',
    },
};

export const ReadOnly: Story = {
    args: {
        defaultChecked: true,
        label: 'Zakljucana postavka',
        readOnly: true,
    },
};

export const Small: Story = {
    args: {
        defaultChecked: true,
        label: 'Kompaktni prikaz',
        size: 'sm',
    },
};

export const WithDescription: Story = {
    args: {
        defaultChecked: true,
        description: 'Koristi se za postavke koje se spremaju odmah.',
        label: 'Tihi nacin',
    },
};

export const InConstrainedRow: Story = {
    render: () => (
        <div className="flex w-64 items-center justify-between gap-4 rounded-md border p-3">
            <span className="min-w-0 flex-1 text-sm">
                Vrlo duga postavka koja ne smije izgurati prekidac izvan reda
            </span>
            <Switch aria-label="Ukljuci dugu postavku" defaultChecked />
        </div>
    ),
};
