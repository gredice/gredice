import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import { Avatar } from '@signalco/ui-primitives/Avatar';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Inputs/AvatarSelectionMenu',
    component: AvatarSelectionMenu,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'AvatarSelectionMenu opens an avatar picker from a custom trigger and reports the selected avatar through its change handler.',
            },
        },
    },
    args: {
        displayName: 'Ana Kovač',
        title: 'Odaberi avatar',
        emptyLabel: 'Prazno',
        onChange: () => {},
        children: (
            <button
                type="button"
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
