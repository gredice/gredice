import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GameAccountMenuPreview } from './GameAccountMenuPreview';

const meta = {
    title: 'packages/ui/Icons/GameAccountMenu',
    component: GameAccountMenuPreview,
    tags: ['autodocs'],
    decorators: [
        (Story, { parameters }) => (
            <div
                className={`${parameters.dark ? 'dark ' : ''}bg-background p-4 text-foreground`}
            >
                <Story />
            </div>
        ),
    ],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Account menu artwork at the 24px size used in-game. This is a static visual preview; navigation belongs to AccountHud.',
            },
        },
    },
} satisfies Meta<typeof GameAccountMenuPreview>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { parameters: { dark: true } };
