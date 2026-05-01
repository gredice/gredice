import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/LocalDateTime',
    component: LocalDateTime,
    tags: ['autodocs'],
    args: {
        children: new Date('2025-06-15T10:30:00'),
        date: true,
        time: true,
        locale: 'hr-HR',
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
