import { expect, test } from '@playwright/experimental-ct-react';
import './globals.css';
import { FarmTodayLoadingState } from './FarmTodayLoadingState';

const phoneViewports = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

for (const viewport of phoneViewports) {
    test(`keeps the compact Today loading shape within ${viewport.width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize(viewport);
        const component = await mount(<FarmTodayLoadingState />);

        const loadingRegion = page.getByRole('region', {
            name: 'Učitavanje današnjih zadataka',
        });
        await expect(loadingRegion).toHaveAttribute('aria-busy', 'true');

        await expect(
            component.locator(
                'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
            ),
        ).toHaveCount(0);

        const summaryItems = component.locator(
            '[data-today-loading-summary-item]',
        );
        await expect(summaryItems).toHaveCount(4);
        expect(
            await summaryItems.evaluateAll((items) => {
                const firstTop = items[0]?.getBoundingClientRect().top;
                return (
                    typeof firstTop === 'number' &&
                    items.every(
                        (item) =>
                            Math.abs(
                                item.getBoundingClientRect().top - firstTop,
                            ) < 1,
                    )
                );
            }),
        ).toBe(true);

        const firstTaskBounds = await component
            .locator('[data-today-loading-task]')
            .boundingBox();
        expect(firstTaskBounds).not.toBeNull();
        if (!firstTaskBounds) {
            throw new Error('Expected the first task loading card to render.');
        }
        expect(firstTaskBounds.y).toBeGreaterThanOrEqual(0);
        expect(firstTaskBounds.y + firstTaskBounds.height).toBeLessThanOrEqual(
            viewport.height,
        );

        expect(
            await component.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return (
                    bounds.left >= 0 &&
                    bounds.right <= window.innerWidth &&
                    element.scrollWidth <= element.clientWidth
                );
            }),
        ).toBe(true);
        expect(
            await page.evaluate(
                () =>
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
            ),
        ).toBe(true);
    });
}
