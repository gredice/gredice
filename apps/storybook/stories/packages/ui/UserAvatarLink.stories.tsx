import { UserAvatarLink } from '@gredice/ui/UserAvatar';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/UserAvatarLink',
    component: UserAvatarLink,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'A public-profile avatar link with an accessible label and keyboard focus indicator. Omitting href preserves a plain avatar when no public profile is available.',
            },
        },
    },
    args: {
        displayName: 'Ana Kovač',
        href: '/korisnici/u_demo',
    },
} satisfies Meta<typeof UserAvatarLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const WithAvatar: Story = {
    args: {
        avatarUrl:
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="24" fill="%23dcfce7"/%3E%3Ccircle cx="24" cy="18" r="8" fill="%23166534"/%3E%3Cpath d="M8 44a16 16 0 0 1 32 0" fill="%23166534"/%3E%3C/svg%3E',
    },
};

export const WithoutPublicProfile: Story = {
    args: { href: undefined },
};

export const GardenOwner: Story = {
    args: { size: 'sm' },
    render: (args) => (
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-4">
            <UserAvatarLink {...args} />
            <span className="font-medium">Anin vrt</span>
        </div>
    ),
};
