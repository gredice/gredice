import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Navigation/NavigatingButton',
    component: NavigatingButton,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'NavigatingButton wraps the shared Button with the arrow affordance used for page-to-page calls to action.',
            },
        },
    },
    args: {
        href: '/',
        children: 'Idi na vrt',
    },
} satisfies Meta<typeof NavigatingButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outlined: Story = {
    args: {
        variant: 'outlined',
    },
};

export const HideArrowUntilHover: Story = {
    args: {
        hideArrow: true,
        variant: 'plain',
    },
};
