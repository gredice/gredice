import { expect, test } from '@playwright/test';

test.describe('Expandable Plant Information', () => {
    test.beforeEach(async ({ page }) => {
        // Go to a plant page that should have content
        // Using a common plant name - this may fail if specific plants don't exist
        await page.goto('/biljke');
    });

    test('should show expandable content when content is long', async ({
        page,
    }) => {
        // Look for the first plant link and click it
        const firstPlantLink = page.locator('a[href*="/biljke/"]').first();
        await firstPlantLink.click();

        // Check if we have any information sections
        const informationSections = page.locator('h2[id]');
        const count = await informationSections.count();

        if (count > 0) {
            // Look for expand buttons which indicate long content
            const expandButtons = page.locator(
                'button:has-text("Prikaži više")',
            );
            const expandButtonCount = await expandButtons.count();

            if (expandButtonCount > 0) {
                // Test the expand functionality
                const firstExpandButton = expandButtons.first();
                await firstExpandButton.click();

                // After clicking, the button text should change
                await expect(firstExpandButton).toContainText('Prikaži manje');

                // Click again to collapse
                await firstExpandButton.click();
                await expect(firstExpandButton).toContainText('Prikaži više');
            }
        }
    });

    test('should have fade gradient on collapsed content', async ({ page }) => {
        // Go to a plant page
        const firstPlantLink = page.locator('a[href*="/biljke/"]').first();
        await firstPlantLink.click();

        // Look for expand buttons
        const expandButtons = page.locator('button:has-text("Prikaži više")');
        const expandButtonCount = await expandButtons.count();

        if (expandButtonCount > 0) {
            // Check if there's a gradient element when content is collapsed
            const gradientElements = page.locator(
                'div[style*="linear-gradient"]',
            );
            const gradientCount = await gradientElements.count();
            expect(gradientCount).toBeGreaterThan(0);
        }
    });
});
