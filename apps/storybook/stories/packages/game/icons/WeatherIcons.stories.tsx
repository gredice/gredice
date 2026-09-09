import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { WeatherIconsShowcase } from './WeatherIconsShowcase';

const meta = {
    title: 'packages/game/Icons/WeatherIcons',
    component: WeatherIconsShowcase,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Composed weather artwork matching the rendered backpack and basket. Seven transparent assets cover 42 stable condition IDs, including day/night, three precipitation intensities, sleet, fog and thunder. The same components render in the game HUD and forecast details.',
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const conditions = canvas.getByRole('region', {
            name: 'All weather conditions',
        });
        await expect(within(conditions).getAllByRole('listitem')).toHaveLength(
            42,
        );
        await expect(within(conditions).getAllByRole('img')).toHaveLength(84);
        const urls = new Set(
            Array.from(canvasElement.querySelectorAll('image'), (image) =>
                image.getAttribute('href'),
            ),
        );
        await expect(urls.size).toBe(7);
        await Promise.all(
            Array.from(urls, async (url) => {
                if (!url) throw new Error('Missing weather artwork URL');
                const image = new Image();
                image.src = url;
                await image.decode();
            }),
        );
        await Promise.all(
            Array.from(canvasElement.querySelectorAll('img'), (image) =>
                image.decode(),
            ),
        );
        for (const chance of [0, 25, 50, 75, 100]) {
            const rain = canvas.getByRole('img', {
                name: `Vjerojatnost oborina: ${chance}%`,
            });
            await expect(rain.querySelector('svg:last-child')).toHaveStyle({
                clipPath: `inset(${100 - chance}% 0 0 0)`,
            });
        }
    },
} satisfies Meta<typeof WeatherIconsShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
