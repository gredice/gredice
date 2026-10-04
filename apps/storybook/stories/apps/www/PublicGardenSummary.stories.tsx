import { PublicGardenSummary } from '@apps/www/app/vrtovi/PublicGardenSummary';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false } },
});

const meta = {
    title: 'apps/www/Gardens/PublicGardenSummary',
    component: PublicGardenSummary,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Creation date, active plant count, and likes shared by the public garden detail and user profile pages.',
            },
        },
    },
    decorators: [
        (Story) => (
            <QueryClientProvider client={queryClient}>
                <Story />
            </QueryClientProvider>
        ),
    ],
    args: {
        garden: { id: 1, createdAt: '2026-03-12T08:00:00.000Z', likeCount: 7 },
        activePlantCount: 24,
    },
    render: (args) => (
        <div className="w-full max-w-2xl overflow-hidden rounded-xl border">
            <PublicGardenSummary {...args} />
        </div>
    ),
} satisfies Meta<typeof PublicGardenSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const EmptyGarden: Story = {
    args: {
        activePlantCount: 0,
        garden: { ...meta.args.garden, likeCount: 0 },
    },
};
export const Mobile: Story = {
    render: (args) => (
        <div className="w-[280px] overflow-hidden rounded-xl border">
            <PublicGardenSummary {...args} />
        </div>
    ),
};
