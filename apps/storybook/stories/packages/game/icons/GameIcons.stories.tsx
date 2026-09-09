import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GameIconGallery } from './GameIconGallery';

const meta = {
    title: 'packages/game/Icons/InGameIcons',
    component: GameIconGallery,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        controls: { disable: true },
        docs: {
            description: {
                component:
                    'Searchable inventory of the icons used by the garden game and its surrounding UI: Lucide exports and aliases, custom glyphs, styled HUD artwork, weather variants, brand marks and emoji. Source locations identify the starting points for replacing monochrome icons with styled game artwork. The first batch of garden illustrations is active; use packages/ui/Icons/GameIcons for the before/after comparison.',
            },
        },
    },
} satisfies Meta<typeof GameIconGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {};
export const LucideIcons: Story = {
    args: { initialGroup: 'Lucide monochrome' },
};
export const CustomMonochrome: Story = {
    args: { initialGroup: 'Custom monochrome' },
};
export const StyledReferences: Story = {
    args: { initialGroup: 'Styled artwork' },
};
export const Weather: Story = { args: { initialGroup: 'Weather' } };

export const StyledGameIllustrations: Story = {
    args: { initialGroup: 'Styled game illustrations' },
};
