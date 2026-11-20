import { expect, test } from '@playwright/experimental-ct-react';
import { SocialIntegrationsOverviewStory } from './SocialIntegrationsOverviewStory';

const longAccountKey =
    'urn:li:organization:123456789012345678901234567890123456789012345';

// 820px is a tablet with the admin navigation collapsed, where the overview
// shows two columns; 390px is a phone, where it shows one.
for (const width of [820, 390]) {
    test(`keeps a long account key clear of its button at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await mount(<SocialIntegrationsOverviewStory />);

        const linkedIn = page
            .getByRole('heading', { name: 'LinkedIn' })
            .locator('xpath=ancestor::section[1]');
        const key = linkedIn.getByText(longAccountKey);
        const configure = linkedIn.getByRole('button', {
            name: 'Konfiguriraj',
        });
        // Measure the text itself: text that overflows does not grow its box.
        const keyTextBox = await key.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const rect = range.getBoundingClientRect();
            return {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
            };
        });
        const [configureBox, tileBox] = await Promise.all([
            configure.boundingBox(),
            linkedIn.boundingBox(),
        ]);
        if (!configureBox || !tileBox) {
            throw new Error('Expected the account row to be measurable');
        }

        const besideButton =
            keyTextBox.top < configureBox.y + configureBox.height &&
            configureBox.y < keyTextBox.bottom;
        if (besideButton) {
            expect(keyTextBox.right).toBeLessThanOrEqual(configureBox.x);
        }
        // The key and the button both stay inside their platform tile.
        expect(keyTextBox.right).toBeLessThanOrEqual(tileBox.x + tileBox.width);
        expect(configureBox.x + configureBox.width).toBeLessThanOrEqual(
            tileBox.x + tileBox.width,
        );

        const twoColumns = tileBox.width < width / 2;
        expect(twoColumns).toBe(width === 820);
    });
}
