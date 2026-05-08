import { UserAvatar } from '@gredice/ui/UserAvatar';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/UserAvatar',
    component: UserAvatar,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'UserAvatar displays either a user image or generated initials with configurable sizing and optional entry animation.',
            },
        },
    },
    args: {
        displayName: 'Ana Kovač',
    },
} satisfies Meta<typeof UserAvatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const WithAvatar: Story = {
    args: {
        avatarUrl: 'https://cdn.gredice.com/avatars/farmer-female.png',
    },
};

export const Animated: Story = {
    args: {
        animate: true,
    },
};

export const Sizes: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <UserAvatar displayName="Ana Kovač" size="sm" />
            <UserAvatar displayName="Ana Kovač" size="md" />
            <UserAvatar displayName="Ana Kovač" size="lg" />
        </div>
    ),
};
