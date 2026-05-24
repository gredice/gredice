import { Avatar } from '@gredice/ui/Avatar';
import { Row } from '@gredice/ui/Row';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Avatar',
    component: Avatar,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Avatar renders either initials or an image in the shared circular identity primitive.',
            },
        },
    },
    args: {
        children: 'AG',
    },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
    render: () => (
        <Row spacing={3}>
            <Avatar size="sm">SM</Avatar>
            <Avatar size="md">MD</Avatar>
            <Avatar size="lg">LG</Avatar>
        </Row>
    ),
};

export const Image: Story = {
    args: {
        alt: 'Farmer avatar',
        src: 'https://cdn.gredice.com/avatars/farmer-female.png',
    },
};

export const Group: Story = {
    render: () => (
        <Row spacing={0}>
            <Avatar className="ring-2 ring-background" size="sm">
                AK
            </Avatar>
            <Avatar className="-ml-2 ring-2 ring-background" size="sm">
                MK
            </Avatar>
            <Avatar className="-ml-2 ring-2 ring-background" size="sm">
                PT
            </Avatar>
        </Row>
    ),
};
