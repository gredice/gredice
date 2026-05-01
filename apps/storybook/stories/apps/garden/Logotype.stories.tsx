import { Logotype } from '@apps/garden/components/Logotype';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/garden/Brand/Logotype',
    component: Logotype,
    tags: ['autodocs'],
    args: {
        className: 'h-12 w-auto',
        color: '#2E6F40',
    },
} satisfies Meta<typeof Logotype>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
