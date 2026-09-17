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
                    'Actual plant-view tabs use matching illustrated artwork. Sowing density is a Storybook-only design comparison: exact repeated planting spots versus miniature seedlings, at compact sizes and inside attribute cards. Production density diagrams are unchanged.',
            },
        },
    },
} satisfies Meta<typeof PlantVisualConsistencyShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
