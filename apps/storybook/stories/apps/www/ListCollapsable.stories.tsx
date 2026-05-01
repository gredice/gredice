import { ListCollapsable } from '@apps/www/components/shared/ListCollapsable';
import { Leaf, Sprout, Droplet } from '@signalco/ui-icons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
    createNavigation,
    getRouter,
    useRouter,
} from '@storybook/nextjs-vite/navigation.mock';

const items = [
    { value: 'povrce', label: 'Povrće', icon: <Leaf className="size-4" />, href: '/biljke/povrce' as const },
    { value: 'voca', label: 'Voće', icon: <Sprout className="size-4" />, href: '/biljke/voca' as const },
    { value: 'zacini', label: 'Začini', icon: <Droplet className="size-4" />, href: '/biljke/zacini' as const },
];

const meta = {
    title: 'apps/www/Shared/ListCollapsable',
    component: ListCollapsable,
    tags: ['autodocs'],
    beforeEach: () => {
        createNavigation({});
        useRouter.mockImplementation(getRouter);
    },
    args: {
        items,
        value: 'Povrće',
    },
    render: (args) => (
        <div className="w-56">
            <ListCollapsable {...args} />
        </div>
    ),
} satisfies Meta<typeof ListCollapsable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondSelected: Story = {
    args: {
        value: 'Voće',
    },
};
