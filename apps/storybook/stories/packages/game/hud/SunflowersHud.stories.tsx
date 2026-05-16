import { SunflowersInfoTooltipContent } from '@packages/game/hud/SunflowersHud';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/game/hud/SunflowersHud',
    component: SunflowersInfoTooltipContent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Sunflower HUD help content explaining how sunflowers are collected, spent, and converted from euro prices.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[min(calc(100vw-2rem),28rem)] overflow-hidden rounded-md border border-border border-b-4 border-b-tertiary bg-popover shadow-sm">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof SunflowersInfoTooltipContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InfoTooltip: Story = {
    name: 'Info tooltip content',
};
