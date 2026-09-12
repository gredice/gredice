import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PlantStatusIconsShowcase } from './PlantStatusIconsShowcase';

const meta = {
    title: 'packages/ui/Icons/PlantStatusIcons',
    component: PlantStatusIconsShowcase,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(
            canvasElement.querySelectorAll('[data-status-example]'),
        ).toHaveLength(13);
        const urls = new Set(
            Array.from(canvasElement.querySelectorAll('image'), (image) =>
                image.getAttribute('href'),
            ),
        );
        await Promise.all(
            Array.from(urls, async (url) => {
                if (!url) throw new Error('Missing plant artwork URL');
                const image = new Image();
                image.src = url;
                await image.decode();
            }),
        );
        await expect(
            canvas.getByRole('button', { name: 'Vlažnost tla: 48%' }),
        ).toBeVisible();
        await expect(
            canvas.getByRole('button', { name: 'Temperatura tla: 22°C' }),
        ).toBeVisible();
        const neighbours = canvas.getByRole('button', {
            name: 'Dobri i loši susjedi',
        });
        await userEvent.click(neighbours);
        await expect(neighbours).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(neighbours);
        const health = canvas.getByRole('button', { name: /Zdravlje biljke/ });
        await userEvent.click(health);
        await waitFor(async () => {
            await expect(
                canvas.getByText('Preporuke za zdravlje biljke.'),
            ).toBeVisible();
        });
        await userEvent.click(health);
        await expect(health).toHaveAttribute('aria-expanded', 'false');
    },
} satisfies Meta<typeof PlantStatusIconsShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
