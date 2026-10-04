import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FaqCategoryShowcase } from './FaqCategoryShowcase';

const meta = {
    title: 'apps/www/FAQ/Categories',
    component: FaqCategoryShowcase,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Reusable FAQ category artwork in the actual category headings. Optional directory image.cover overrides the default artwork; unknown or unavailable images fall back to the game information icon. Answers here are local fixtures.',
            },
        },
    },
} satisfies Meta<typeof FaqCategoryShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
export const Mobile: Story = {
    globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export const ReusableSizes: Story = { args: { compact: true } };
export const MissingAndCustomImages: Story = { args: { fallback: true } };
