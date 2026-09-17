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
                    'Five shared package illustrations, the actual package card and earn/spend history, and a separate 3D mascot proposal. Checkout is inert in this offline preview. Existing mascot/currency uses remain unchanged.',
            },
        },
    },
} satisfies Meta<typeof SunflowerEconomyShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
export const NarrowProfile: Story = { args: { compact: true } };
