import { GardenActionStory } from '@apps/garden/tests/GardenActionStory';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/game/HUD/GardenActionHud',
    component: GardenActionStory,
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GardenActionStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Plant: Story = { args: { searchParams: 'sijanje=1' } };
export const Variety: Story = { args: { searchParams: 'sijanje=1&sorta=101' } };
export const Operation: Story = { args: { searchParams: 'radnja=501' } };
export const FullBeds: Story = { args: { full: true } };
