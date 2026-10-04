import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { GameIconsShowcase } from './GameIconsShowcase';

const meta = {
    title: 'packages/ui/Icons/GameIcons',
    component: GameIconsShowcase,
    tags: ['autodocs'],
    play: async ({ canvasElement }) => {
        await canvasElement.ownerDocument.fonts.ready;
        const imageUrls = new Set(
            Array.from(canvasElement.querySelectorAll('image'), (image) =>
                image.getAttribute('href'),
            ),
        );
        // A correctly sized SVG wrapper must never conceal a missing bitmap.
        await Promise.all(
            Array.from(imageUrls, async (url) => {
                if (!url) throw new Error('Missing game artwork URL');
                const image = new Image();
                image.src = url;
                await image.decode();
            }),
        );
        const canvas = within(canvasElement);
        const bedGroup = within(
            canvas.getByRole('region', { name: 'Gredica' }),
        );
        const informationTab = bedGroup.getByRole('tab', {
            name: 'Informacije',
        });
        await userEvent.click(informationTab);
        await expect(informationTab).toHaveAttribute('aria-selected', 'true');
        await expect(
            bedGroup.getByRole('tabpanel', { name: 'Informacije' }),
        ).toHaveTextContent('Gredica A12');
        await userEvent.keyboard('{ArrowLeft}');
        await expect(
            bedGroup.getByRole('tab', { name: 'Radnje' }),
        ).toHaveFocus();
        await userEvent.click(bedGroup.getByRole('tab', { name: 'Dnevnik' }));
        const historicalGroup = within(
            canvas.getByRole('region', {
                name: 'Prethodna biljka',
            }),
        );
        await expect(
            historicalGroup.queryByRole('tab', { name: 'Radnje' }),
        ).not.toBeInTheDocument();
        for (const group of canvasElement.querySelectorAll(
            '[data-icon-group]',
        )) {
            const bounds = group.getBoundingClientRect();
            for (const tab of group.querySelectorAll('[role="tab"]')) {
                await expect(tab.querySelector('svg image')).not.toBeNull();
                const tabBounds = tab.getBoundingClientRect();
                await expect(tabBounds.left).toBeGreaterThanOrEqual(
                    bounds.left - 0.5,
                );
                await expect(tabBounds.right).toBeLessThanOrEqual(
                    bounds.right + 0.5,
                );
            }
        }
        for (const physicalId of ['0', '7', 'A12', '1234', 'ZG-12345']) {
            const example = canvasElement.querySelector(
                `[data-bed-example="${physicalId}"]`,
            );
            const wrapper = example?.querySelector(
                '[title="Identifikator gredice"]',
            );
            const label = wrapper?.querySelector('span:not([aria-hidden])');
            const glyph = wrapper?.querySelector('svg');
            const neighbour = example?.lastElementChild;
            if (!wrapper || !label || !glyph || !neighbour) {
                throw new Error(
                    `Missing physical-identifier example: ${physicalId}`,
                );
            }
            await expect(label).toBeVisible();
            await expect(label).toHaveTextContent(physicalId);
            const labelRect = label.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();
            const glyphRect = glyph.getBoundingClientRect();
            const artworkTop =
                glyphRect.top +
                (glyph.getBBox().y * glyphRect.height) /
                    glyph.viewBox.baseVal.height;
            // Reserve the label's actual width even when the caller requests w-6.
            await expect(labelRect.left).toBeGreaterThanOrEqual(
                wrapperRect.left - 0.5,
            );
            await expect(labelRect.right).toBeLessThanOrEqual(
                wrapperRect.right + 0.5,
            );
            await expect(labelRect.bottom).toBeLessThanOrEqual(artworkTop);
            await expect(labelRect.right).toBeLessThan(
                neighbour.getBoundingClientRect().left,
            );
        }
    },
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Transparent rendered artwork for the garden game, styled against the existing backpack and basket. Existing monochrome exports remain available. Raised-bed artwork uses the established physical-identifier position, reserves label width and provides a contrasting text backing.',
            },
        },
    },
} satisfies Meta<typeof GameIconsShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { args: { dark: true } };
