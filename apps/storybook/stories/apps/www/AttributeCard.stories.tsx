import { AttributeCard } from '@apps/www/components/attributes/DetailCard';
import {
    GameLeafIcon,
    GameSeedlingIcon,
    GameWaterIcon,
} from '@gredice/ui/GameIcons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Attributes/AttributeCard',
    component: AttributeCard,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'AttributeCard displays a labeled plant or product attribute with an icon, value, optional description, and optional navigation.',
            },
        },
    },
    args: {
        icon: <GameLeafIcon aria-hidden className="size-6" />,
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
        icon: <GameSeedlingIcon aria-hidden className="size-6" />,
        value: 'ožujak – travanj',
    },
};

export const WithDescription: Story = {
    args: {
        header: 'Zalijevanje',
        icon: <GameWaterIcon aria-hidden className="size-6" />,
        value: '2× tjedno',
        description:
            'Rajčica preferira duboko ali manje učestalo zalijevanje. Izbjegavajte vlaženje lišća.',
    },
};

export const WithNavigation: Story = {
    args: {
        header: 'Sorta',
        icon: <GameLeafIcon aria-hidden className="size-6" />,
        value: 'Cherry',
        navigateLabel: 'Više o sorti',
        navigateHref: '/sorte/cherry',
    },
};

export const EmptyValue: Story = {
    args: {
        header: 'Prinos',
        icon: <GameLeafIcon aria-hidden className="size-6" />,
        value: undefined,
    },
};
