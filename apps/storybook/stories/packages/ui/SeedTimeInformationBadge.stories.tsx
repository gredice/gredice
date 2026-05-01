import { SeedTimeInformationBadge } from '@gredice/ui/plants';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Plants/SeedTimeInformationBadge',
    component: SeedTimeInformationBadge,
    tags: ['autodocs'],
    args: {
        size: 'md',
    },
} satisfies Meta<typeof SeedTimeInformationBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

export const Small: Story = {
    args: { size: 'sm' },
};

export const Large: Story = {
    args: { size: 'lg' },
};
