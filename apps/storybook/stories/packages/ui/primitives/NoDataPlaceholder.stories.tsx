import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/NoDataPlaceholder',
    component: NoDataPlaceholder,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'NoDataPlaceholder provides a compact empty-state message for tables, lists, and dashboards.',
            },
        },
    },
    args: {
        children: 'Nema rezultata za odabrane filtere.',
    },
    render: (args) => (
        <div className="w-80 rounded-lg border bg-card p-6">
            <NoDataPlaceholder {...args} />
        </div>
    ),
} satisfies Meta<typeof NoDataPlaceholder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FallbackCopy: Story = {
    args: {
        children: undefined,
    },
};
