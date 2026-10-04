import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PublicVisualsShowcase } from './PublicVisualsShowcase';

const meta = {
    title: 'apps/www/Visuals/PublicVisuals',
    component: PublicVisualsShowcase,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Public-site icon and editorial artwork examples using the actual AboutValueCard, PlantHealthIssueCard, AttributeCard and PublicGardenIllustration components. Full decisions and retained emojis are recorded in docs/www-visual-audit.md.',
            },
        },
    },
} satisfies Meta<typeof PublicVisualsShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
