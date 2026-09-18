import { getAchievementDefinitions } from '@gredice/js/achievements';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { AchievementAwardsShowcase } from './AchievementAwardsShowcase';

const meta = {
    title: 'packages/ui/AchievementAwards',
    component: AchievementAwardsShowcase,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    play: async ({ canvasElement }) => {
        const definitions = getAchievementDefinitions();
        await expect(
            canvasElement.querySelectorAll('[data-award-example]'),
        ).toHaveLength(definitions.length);
        const dedicatedImages = canvasElement.querySelectorAll(
            '[data-award-example] svg:not([data-achievement-placeholder]) image',
        );
        const urls = new Set(
            Array.from(dedicatedImages, (image) => image.getAttribute('href')),
        );
        await expect(urls.size).toBe(34);
        await Promise.all(
            Array.from(urls, async (url) => {
                if (!url) throw new Error('Missing achievement artwork');
                const image = new Image();
                image.src = url;
                await image.decode();
                await expect(image.naturalWidth).toBe(512);
            }),
        );
    },
} satisfies Meta<typeof AchievementAwardsShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
