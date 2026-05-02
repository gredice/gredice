import { Logotype } from '@apps/www/components/Logotype';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Brand/Logotype',
    component: Logotype,
    tags: ['autodocs'],
    args: {
        className: 'h-12 w-auto',
    },
} satisfies Meta<typeof Logotype>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
