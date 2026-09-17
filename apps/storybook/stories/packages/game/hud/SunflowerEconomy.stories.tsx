import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SunflowerEconomyShowcase } from './SunflowerEconomyShowcase';

const meta = {
    title: 'packages/game/hud/SunflowerEconomy',
    component: SunflowerEconomyShowcase,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Five shared package illustrations, the actual package card and earn/spend history, and the approved shared 3D mascot. Checkout is inert in this offline preview. The Majstor vrtlar package uses a golden wheelbarrow.',
            },
        },
    },
} satisfies Meta<typeof SunflowerEconomyShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
export const NarrowProfile: Story = { args: { compact: true } };
