import { ErrorFallback } from '@gredice/ui/ErrorFallback';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Feedback/ErrorFallback',
    component: ErrorFallback,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
    args: {
        correlationId: 'err-20250501-abc123',
        onRetry: () => {},
        variant: 'page',
    },
} satisfies Meta<typeof ErrorFallback>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Page: Story = {};

export const Global: Story = {
    args: {
        variant: 'global',
    },
};
