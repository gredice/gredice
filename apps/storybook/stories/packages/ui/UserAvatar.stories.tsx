import {
    UserAchievementProgress,
    UserAvatar,
    UserLevelBadge,
} from '@gredice/ui/UserAvatar';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FarmerAvatarsPreview } from './FarmerAvatarsPreview';

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

export const Farmers: Story = {
    render: () => <FarmerAvatarsPreview />,
};

export const FarmersDark: Story = {
    render: () => (
        <div className="dark rounded-lg bg-background p-6 text-foreground">
            <FarmerAvatarsPreview />
        </div>
    ),
};

export const Levels: Story = {
    render: () => (
        <div className="flex flex-wrap gap-8 p-4">
            {[0, 1, 3, 10, 21, 34].map((count) => (
                <div key={count} className="space-y-3">
                    <UserAvatar
                        displayName="Ana Kovač"
                        achievementCount={count}
                        size="lg"
                    />
                    <UserAchievementProgress achievementCount={count} />
                </div>
            ))}
        </div>
    ),
};

export const CompactLevels: Story = {
    render: () => (
        <div className="flex items-center gap-8 p-4">
            <UserAvatar
                displayName="Ana Kovač"
                achievementCount={0}
                size="sm"
            />
            <UserAvatar
                displayName="Marko Marić"
                achievementCount={10}
                size="md"
            />
            <UserAvatar
                displayName="Veseli vrtlar"
                avatarUrl="https://cdn.gredice.com/avatars/farmer-female.png"
                achievementCount={21}
                size="lg"
            />
            <UserLevelBadge level={12} />
        </div>
    ),
};

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

export const InitialsInColoredParent: Story = {
    render: () => (
        <div className="inline-flex items-center gap-2 rounded-full bg-green-800 px-3 py-2 text-white">
            <UserAvatar displayName="Ana Kovač" size="sm" />
            <span className="text-sm font-medium">Moj vrt</span>
        </div>
    ),
};
