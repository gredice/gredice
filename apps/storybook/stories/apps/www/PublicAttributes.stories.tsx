import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PublicAttributesShowcase } from './PublicAttributesShowcase';

const meta = {
    title: 'apps/www/Attributes/PublicAttributes',
    component: PublicAttributesShowcase,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Actual plant, operation, seed and block attribute cards with shared game artwork. Plant-density diagrams, barcode encoding, units and numeric values remain functional information.',
            },
        },
    },
} satisfies Meta<typeof PublicAttributesShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
export const MissingAndZeroValues: Story = { args: { missing: true } };
