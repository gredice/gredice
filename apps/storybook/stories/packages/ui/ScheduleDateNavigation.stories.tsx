import { ScheduleDateNavigation } from '@gredice/ui/ScheduleDateNavigation';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Navigation/ScheduleDateNavigation',
    component: ScheduleDateNavigation,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'ScheduleDateNavigation renders previous/next day links around the selected date and shows the human-readable date. It is used at the top of schedule views in the admin and farm apps to navigate between days.',
            },
        },
    },
    args: {
        date: new Date('2025-06-09'),
        basePath: '/schedule',
    },
    render: (args) => (
        <div className="flex justify-center p-4">
            <ScheduleDateNavigation {...args} />
        </div>
    ),
} satisfies Meta<typeof ScheduleDateNavigation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Today: Story = {
    args: {
        date: new Date(),
    },
};

export const CustomParam: Story = {
    args: {
        basePath: '/admin/schedule',
        paramName: 'date',
    },
};
