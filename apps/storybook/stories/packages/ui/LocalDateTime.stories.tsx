import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const sampleDate = '2025-06-15T08:30:00.000Z';

const meta = {
    title: 'packages/ui/Data Display/LocalDateTime',
    component: LocalDateTime,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'LocalDateTime formats Date, string, or empty values for the selected locale with independent date and time display controls.',
            },
        },
    },
    args: {
        children: sampleDate,
        date: true,
        time: true,
        locale: 'hr-HR',
    },
    argTypes: {
        children: {
            control: 'text',
            table: {
                type: {
                    summary: 'Date | string | null | undefined',
                },
            },
        },
    },
} satisfies Meta<typeof LocalDateTime>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DateAndTime: Story = {};

export const DateOnly: Story = {
    args: {
        time: false,
    },
};

export const TimeOnly: Story = {
    args: {
        date: false,
    },
};

export const NullValue: Story = {
    args: {
        children: null,
    },
};

export const StringInput: Story = {
    args: {
        children: '2025-03-21T08:00:00Z',
    },
};
