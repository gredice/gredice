import { AttributeCard } from '@apps/www/components/attributes/DetailCard';
import { Leaf, Sprout, Droplet } from '@signalco/ui-icons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Attributes/AttributeCard',
    component: AttributeCard,
    tags: ['autodocs'],
    args: {
        icon: <Leaf className="size-5 text-primary" />,
        header: 'Tip biljke',
        value: 'Povrtnica',
    },
    render: (args) => (
        <div className="w-72">
            <AttributeCard {...args} />
        </div>
    ),
} satisfies Meta<typeof AttributeCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSubheader: Story = {
    args: {
        header: 'Sezona sjetve',
        subheader: 'na otvorenom',
        icon: <Sprout className="size-5 text-primary" />,
        value: 'ožujak – travanj',
    },
};

export const WithDescription: Story = {
    args: {
        header: 'Zalijevanje',
        icon: <Droplet className="size-5 text-primary" />,
        value: '2× tjedno',
        description:
            'Rajčica preferira duboko ali manje učestalo zalijevanje. Izbjegavajte vlaženje lišća.',
    },
};

export const WithNavigation: Story = {
    args: {
        header: 'Sorta',
        icon: <Leaf className="size-5 text-primary" />,
        value: 'Cherry',
        navigateLabel: 'Više o sorti',
        navigateHref: '/sorte/cherry',
    },
};

export const EmptyValue: Story = {
    args: {
        header: 'Prinos',
        icon: <Leaf className="size-5 text-primary" />,
        value: undefined,
    },
};
