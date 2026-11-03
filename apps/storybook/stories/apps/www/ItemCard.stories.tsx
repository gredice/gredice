import { ItemCard } from '@apps/www/components/shared/ItemCard';
import { Button } from '@gredice/ui/Button';
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

export const WithFooter: Story = {
    args: {
        footer: (
            <div className="flex items-center justify-between gap-2 border-t pt-2">
                <span className="font-bold">4.99€</span>
                <Button
                    href="https://vrt.gredice.com/?sijanje=1"
                    navigation="document"
                    size="sm"
                >
                    Posadi
                </Button>
            </div>
        ),
    },
    parameters: {
        docs: {
            description: {
                story: 'The footer sits outside the card link, so its controls are not nested in it; the rest of the card still opens the item.',
            },
        },
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
