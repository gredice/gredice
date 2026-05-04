import { SeedTimeInformationBadge } from '@gredice/ui/plants';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Plants/SeedTimeInformationBadge',
    component: SeedTimeInformationBadge,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'SeedTimeInformationBadge summarizes plant sowing timing in a compact badge that can scale across dense and spacious layouts.',
            },
        },
    },
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
