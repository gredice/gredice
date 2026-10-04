import NotFound from '@apps/www/app/not-found';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Feedback/NotFound',
    component: NotFound,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof NotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
