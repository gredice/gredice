import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PublicCatalogVisualsShowcase } from './PublicCatalogVisualsShowcase';

const meta = {
    title: 'apps/www/Visuals/PublicCatalogVisuals',
    component: PublicCatalogVisualsShowcase,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicCatalogVisualsShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
