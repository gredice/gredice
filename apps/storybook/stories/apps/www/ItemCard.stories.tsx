import { ItemCard } from '@apps/www/components/shared/ItemCard';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Shared/ItemCard',
    component: ItemCard,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'ItemCard is a linked visual tile for public listing grids, pairing media content with a short item label.',
            },
        },
    },
    args: {
        label: 'Rajčica',
        href: '/biljke/rajcica',
        children: (
            <div className="flex size-full items-center justify-center bg-red-50 text-5xl">
                🍅
            </div>
        ),
    },
    render: (args) => (
        <div className="w-48">
            <ItemCard {...args} />
        </div>
    ),
} satisfies Meta<typeof ItemCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLongLabel: Story = {
    args: {
        label: 'Cherry rajčica Gardeners Delight',
    },
};

export const Grid: Story = {
    render: () => (
        <div className="grid grid-cols-3 gap-4 w-96">
            {[
                'Rajčica 🍅',
                'Paprika 🫑',
                'Krastavac 🥒',
                'Tikvica 🥒',
                'Patlidžan 🍆',
                'Mrkva 🥕',
            ].map((label) => (
                <ItemCard key={label} label={label} href={`/biljke/${label}`}>
                    <div className="flex size-full items-center justify-center bg-green-50 text-3xl">
                        {label.split(' ')[1]}
                    </div>
                </ItemCard>
            ))}
        </div>
    ),
};
