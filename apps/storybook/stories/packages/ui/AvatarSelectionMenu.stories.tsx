import { Avatar } from '@gredice/ui/Avatar';
import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AvatarSelectionPreview } from './AvatarSelectionPreview';

const meta = {
    title: 'packages/ui/Inputs/AvatarSelectionMenu',
    component: AvatarSelectionMenu,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'A responsive avatar gallery with 29 gardeners, animals and fantasy characters. Shows the saved selection, preserves stable profile values and can restore initials.',
            },
        },
    },
    args: {
        avatarUrl: null,
        displayName: 'Ana Kovač',
        title: 'Odaberi avatar',
        emptyLabel: 'Prazno',
        onChange: () => {},
        children: (
            <button
                type="button"
                aria-label="Promijeni avatar"
                className="rounded-full ring-2 ring-primary ring-offset-2 cursor-pointer"
            >
                <Avatar size="lg">AK</Avatar>
            </button>
        ),
    },
    render: (args) => (
        <div className="flex h-32 items-center justify-center">
            <AvatarSelectionMenu {...args} />
        </div>
    ),
} satisfies Meta<typeof AvatarSelectionMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Gallery: Story = {
    render: () => <AvatarSelectionPreview />,
};
