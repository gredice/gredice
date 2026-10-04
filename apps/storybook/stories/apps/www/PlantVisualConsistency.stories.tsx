import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PlantVisualConsistencyShowcase } from './PlantVisualConsistencyShowcase';

const meta = {
    title: 'apps/www/Visuals/PlantVisualConsistency',
    component: PlantVisualConsistencyShowcase,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Actual plant-view tabs and sowing-density icons use matching illustrated artwork. The shared PlantGridIcon preserves exact counts, including 25 and 36, using one soil tile and a repeated planting spot. Compare the previous capped diagrams with the new layouts at compact sizes and inside real attribute cards.',
            },
        },
    },
} satisfies Meta<typeof PlantVisualConsistencyShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
