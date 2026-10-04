import { Avatar } from '@gredice/ui/Avatar';
import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Skeleton',
    component: Skeleton,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Skeleton provides the shared muted loading placeholder for rows, cards, and text blocks.',
            },
        },
    },
    args: {
        className: 'h-5 w-48',
    },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TextRows: Story = {
    render: () => (
        <Stack spacing={2}>
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
        </Stack>
    ),
};

export const AvatarRow: Story = {
    render: () => (
        <Row spacing={3}>
            <Avatar size="md"> </Avatar>
            <Stack spacing={2}>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
            </Stack>
        </Row>
    ),
};

export const CardPlaceholder: Story = {
    render: () => (
        <div className="w-80 rounded-lg border bg-card p-4">
            <Stack spacing={4}>
                <Skeleton className="h-36 w-full" />
                <Stack spacing={2}>
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </Stack>
            </Stack>
        </div>
    ),
};
