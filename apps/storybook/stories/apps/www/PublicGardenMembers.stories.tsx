import { PublicGardenMembers } from '@apps/www/app/vrtovi/PublicGardenMembers';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const members = [
    'Ana Kovač',
    'Marko Marić',
    'Petra Horvat',
    'Iva Novak',
    'Veseli vrtlar s vrlo dugim imenom',
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
    title: 'apps/www/Gardens/PublicGardenMembers',
    component: PublicGardenMembers,
    tags: ['autodocs'],
    args: { gardenId: 59, members },
    render: (args) => (
        <div className="max-w-lg rounded-lg bg-card p-4 text-card-foreground">
            <PublicGardenMembers {...args} />
        </div>
    ),
} satisfies Meta<typeof PublicGardenMembers>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NamedMembers: Story = {};
export const PreviewStack: Story = { args: { compact: true } };
export const SingleMember: Story = { args: { members: members.slice(0, 1) } };
export const Empty: Story = { args: { members: [] } };
export const Mobile: Story = {
    render: (args) => (
        <div className="w-[280px] rounded-lg bg-card p-4 text-card-foreground">
            <PublicGardenMembers {...args} />
        </div>
    ),
};
