import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/SegmentedCircularProgress',
    component: SegmentedCircularProgress,
    tags: ['autodocs'],
    args: {
        segments: [
            {
                color: 'stroke-green-600',
                percentage: 45,
                trackColor: 'stroke-green-100',
                value: 70,
            },
            {
                color: 'stroke-amber-500',
                percentage: 30,
                trackColor: 'stroke-amber-100',
                value: 45,
            },
            {
                color: 'stroke-sky-500',
                percentage: 25,
                trackColor: 'stroke-sky-100',
                value: 82,
            },
        ],
        size: 128,
        strokeWidth: 3,
    },
    render: (args) => (
        <SegmentedCircularProgress {...args}>
            <span className="font-mono text-lg font-semibold text-primary">
                72%
            </span>
        </SegmentedCircularProgress>
    ),
} satisfies Meta<typeof SegmentedCircularProgress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
