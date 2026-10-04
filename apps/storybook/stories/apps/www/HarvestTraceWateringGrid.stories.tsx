import { HarvestTraceWateringGrid } from '@apps/www/app/trag/[token]/HarvestTraceWateringGrid';
import type { HarvestTraceWateringGridItem } from '@apps/www/app/trag/[token]/wateringGridModel';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const timeline = [
    {
        occurredAt: '2026-04-08T08:00:00.000Z',
    },
    ...Array.from({ length: 34 }, (_, index) => ({
        isWatering: true,
        occurredAt: new Date(
            Date.UTC(2026, 3, 10 + index * 3, 8),
        ).toISOString(),
        operationCount: index % 8 === 0 ? 3 : index % 3 === 0 ? 2 : 1,
    })),
    {
        occurredAt: '2026-07-24T08:00:00.000Z',
    },
] satisfies HarvestTraceWateringGridItem[];

const meta = {
    title: 'apps/www/Trace/HarvestTraceWateringGrid',
    component: HarvestTraceWateringGrid,
    tags: ['autodocs'],
    args: { timeline },
    parameters: {
        docs: {
            description: {
                component:
                    'Compact daily watering heatmap embedded in the watering statistics card on the public harvest trace.',
            },
        },
        layout: 'fullscreen',
    },
    render: (args) => (
        <div className="mx-auto max-w-4xl bg-background p-4 sm:p-8">
            <div className="max-w-sm rounded-lg border bg-card p-3">
                <HarvestTraceWateringGrid {...args} />
            </div>
        </div>
    ),
} satisfies Meta<typeof HarvestTraceWateringGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DarkMode: Story = {
    render: (args) => (
        <div className="dark min-h-screen bg-background p-4 text-foreground sm:p-8">
            <div className="mx-auto max-w-4xl">
                <div className="max-w-sm rounded-lg border bg-card p-3">
                    <HarvestTraceWateringGrid {...args} />
                </div>
            </div>
        </div>
    ),
};
