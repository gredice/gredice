import { PageNav } from '@gredice/ui/Nav';
import { expect, test } from '@playwright/experimental-ct-react';
import '../app/globals.css';

test('is transparent at the top and surfaces after scrolling', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="min-h-[200dvh]">
            <PageNav logo={<span>Gredice</span>} />
        </div>,
    );

    const header = page.locator('header');
    await expect
        .poll(() =>
            header.evaluate(
                (element) => getComputedStyle(element).backgroundColor,
            ),
        )
        .toBe('rgba(0, 0, 0, 0)');

    await page.evaluate(() => window.scrollTo(0, 100));

    await expect(header).toHaveClass(/bg-background\/80/u);
    await expect
        .poll(() =>
            header.evaluate(
                (element) => getComputedStyle(element).backgroundColor,
            ),
        )
        .not.toBe('rgba(0, 0, 0, 0)');
});
