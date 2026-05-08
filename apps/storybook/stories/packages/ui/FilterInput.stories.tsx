import { FilterInput } from '@gredice/ui/FilterInput';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Inputs/FilterInput',
    component: FilterInput,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'FilterInput binds a search field to URL query state and can update either on submit or immediately as the user types.',
            },
        },
    },
    args: {
        searchParamName: 'q',
        fieldName: 'search',
        instant: false,
    },
    render: (args) => (
        <div className="w-72">
            <FilterInput {...args} />
        </div>
    ),
} satisfies Meta<typeof FilterInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Instant: Story = {
    args: {
        instant: true,
    },
};
