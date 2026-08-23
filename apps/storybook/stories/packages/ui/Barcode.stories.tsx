import { BarcodeValue } from '@gredice/ui/Barcode';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/Barcode',
    component: BarcodeValue,
    tags: ['autodocs'],
    args: {
        value: '3858890410952',
    },
} satisfies Meta<typeof BarcodeValue>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TextFallback: Story = {
    args: {
        value: 'Kamilica šifra',
    },
};
