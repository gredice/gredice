import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Navigation/Breadcrumbs',
    component: Breadcrumbs,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Breadcrumbs provides compact path context for admin details and public content pages.',
            },
        },
    },
    args: {
        items: [
            { label: 'Admin', href: '/' },
            { label: 'Inventar', href: '/' },
            { label: 'Sjeme rikole' },
        ],
    },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTrailingSeparator: Story = {
    args: {
        endSeparator: true,
    },
};

export const LongLabels: Story = {
    args: {
        items: [
            { label: 'Biljke', href: '/' },
            {
                label: 'Vrlo dug naziv biljke koji mora ostati citljiv u uskom prostoru',
                href: '/',
            },
            { label: 'Sorta za proljetnu sadnju' },
        ],
    },
    render: (args) => (
        <div className="w-72">
            <Breadcrumbs {...args} />
        </div>
    ),
};

export const CollapsedMiddleItems: Story = {
    args: {
        items: [
            { label: 'Gredice', href: '/' },
            { label: 'Računi', href: '/' },
            { label: 'd5048f9f-51c2-48f4-85d5-4bed9e8e06c2', href: '/' },
            { label: 'Vrtovi', href: '/' },
            { label: '24', href: '/' },
            { label: 'Gredice', href: '/' },
            { label: '33' },
        ],
    },
};
