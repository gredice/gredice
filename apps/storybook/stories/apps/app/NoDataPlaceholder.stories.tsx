import { NoDataPlaceholder } from '@apps/app/components/shared/placeholders/NoDataPlaceholder';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/app/Shared/NoDataPlaceholder',
    component: NoDataPlaceholder,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'NoDataPlaceholder provides a compact empty state message for admin and app views when a list or query has no results.',
            },
        },
    },
    args: {
        children: 'No records match the current filters.',
    },
    render: (args) => (
        <div className="w-80 rounded-lg border border-border bg-card p-6">
            <NoDataPlaceholder {...args} />
        </div>
    ),
} satisfies Meta<typeof NoDataPlaceholder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
