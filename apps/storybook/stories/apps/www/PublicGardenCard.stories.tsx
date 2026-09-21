import { PublicGardenCard } from '@apps/www/app/vrtovi/PublicGardenCard';
import { PublicChromeProvider } from '@gredice/ui/PublicChrome';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const members = [
    'Ana Kovač',
    'Marko Marić',
    'Petra Horvat',
    'Iva Novak',
    'Korisnik Gredica',
].map((displayName, index) => ({
    publicId: `u_member${index}`,
    displayName,
    avatarUrl:
        index === 0
            ? 'https://cdn.gredice.com/avatars/farmer-female.png'
            : null,
    achievementCount: index * 3,
}));

const meta = {
    title: 'apps/www/Gardens/PublicGardenCard',
    component: PublicGardenCard,
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <PublicChromeProvider>
                <div className="max-w-sm">
                    <Story />
                </div>
            </PublicChromeProvider>
        ),
    ],
    args: {
        garden: {
            id: 59,
            name: 'Zajednički vrt',
            members,
            owner: members[0],
            activePlantCount: 31,
            likeCount: 2,
            backgroundPalette: 'current',
            homeCamera: null,
            isSandbox: false,
            previewImage: null,
            previewImages: { day: null, night: null },
            createdAt: '2026-07-07T00:00:00.000Z',
            updatedAt: '2026-09-21T00:00:00.000Z',
        },
    },
} satisfies Meta<typeof PublicGardenCard>;

export default meta;
type Story = StoryObj<typeof PublicGardenCard>;

export const SharedGarden: Story = {};
export const SingleMember: Story = {
    args: { garden: { ...meta.args.garden, members: members.slice(0, 1) } },
};
export const NoMembers: Story = {
    args: { garden: { ...meta.args.garden, members: [], owner: null } },
};
