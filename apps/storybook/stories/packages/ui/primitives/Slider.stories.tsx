import { Slider } from '@gredice/ui/Slider';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Inputs/Slider',
    component: Slider,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Slider wraps the Radix slider primitive for numeric settings used in game and operations controls.',
            },
        },
    },
    args: {
        defaultValue: [40],
        label: 'Glasnoca',
        max: 100,
        min: 0,
        step: 5,
    },
    render: (args) => (
        <div className="w-72">
            <Slider {...args} />
        </div>
    ),
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FineStep: Story = {
    args: {
        defaultValue: [12],
        label: 'Rotacija biljke',
        max: 20,
        step: 1,
    },
};

export const Disabled: Story = {
    args: {
        defaultValue: [70],
        disabled: true,
        label: 'Zakljucana vrijednost',
    },
};

export const CustomTrack: Story = {
    args: {
        defaultValue: [65],
        label: 'Vlaga tla',
        rangeClassName: 'bg-emerald-600',
        trackClassName: 'bg-emerald-100',
    },
};
