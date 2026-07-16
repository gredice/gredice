import { mkdir } from 'node:fs/promises';
import { test } from '@playwright/experimental-ct-react';
import '../app/globals.css';
import { PwaInstallPreview } from './PwaInstallPreview';

const screenshots = [
    {
        outputPath: './public/screenshots/farm-today-390x844.png',
        viewport: { height: 844, width: 390 },
    },
    {
        outputPath: './public/screenshots/farm-today-1280x720.png',
        viewport: { height: 720, width: 1280 },
    },
] as const;

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
});

for (const screenshot of screenshots) {
    test(`generates ${screenshot.viewport.width}x${screenshot.viewport.height} install screenshot`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize(screenshot.viewport);
        await mkdir('./public/screenshots', { recursive: true });
        await mount(<PwaInstallPreview />);
        await page.evaluate(() => document.fonts.ready);

        await page.screenshot({
            animations: 'disabled',
            fullPage: false,
            path: screenshot.outputPath,
        });
    });
}

test('generates the monochrome notification badge', async ({ mount, page }) => {
    await page.setViewportSize({ height: 96, width: 96 });
    await page.evaluate(() => {
        document.documentElement.style.backgroundColor = 'transparent';
        document.body.style.backgroundColor = 'transparent';
    });

    const badge = await mount(
        <svg
            aria-label="Gredice notification badge"
            height="96"
            role="img"
            viewBox="0 0 96 96"
            width="96"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M48 82V43"
                fill="none"
                stroke="#000"
                strokeLinecap="round"
                strokeWidth="9"
            />
            <path d="M45 47C28 48 18 38 17 21c17-1 29 9 28 26Z" fill="#000" />
            <path d="M51 43c17 1 28-9 28-26-17-1-29 9-28 26Z" fill="#000" />
        </svg>,
    );

    await badge.screenshot({
        animations: 'disabled',
        omitBackground: true,
        path: './public/notification-badge-96x96.png',
    });
});
