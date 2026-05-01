import { CountingNumber } from '@gredice/ui/CountingNumber';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/CountingNumber',
    component: CountingNumber,
    tags: ['autodocs'],
    args: {
        className: 'font-mono text-4xl font-semibold text-primary',
        fromNumber: 1200,
        number: 2480,
    },
} satisfies Meta<typeof CountingNumber>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Decimal: Story = {
    args: {
        decimalPlaces: 1,
        fromNumber: 0,
        number: 87.6,
    },
};
