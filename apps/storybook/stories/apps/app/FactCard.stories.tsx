import { FactCard } from '@apps/app/components/admin/cards/FactCard';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/app/Admin/FactCard',
    component: FactCard,
    tags: ['autodocs'],
    args: {
        beforeValue: 108,
        header: 'Active subscriptions',
        value: 126,
    },
    render: (args) => (
        <div className="w-72">
            <FactCard {...args} />
        </div>
    ),
} satisfies Meta<typeof FactCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutChange: Story = {
    args: {
        beforeValue: undefined,
        header: 'Open tasks',
        value: 34,
    },
};
