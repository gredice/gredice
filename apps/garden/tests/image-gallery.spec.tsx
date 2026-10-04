import { ImageGallery } from '@gredice/ui/ImageGallery';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 640 };

const wideImageSvg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="900" viewBox="0 0 2400 900"><rect width="2400" height="900" fill="#86b6d6"/><rect y="520" width="2400" height="380" fill="#4f7d45"/><path d="M0 610 C360 470 680 700 1040 560 S1750 520 2400 610" fill="#8db15d"/><text x="1200" y="450" text-anchor="middle" font-size="120" font-family="Arial" fill="#1f2937">2400 x 900 panorama</text></svg>',
);
const wideImageSrc = `data:image/svg+xml,${wideImageSvg}`;

const images = [
    {
        src: wideImageSrc,
        alt: 'Wide garden panorama',
    },
];

async function expectViewportBounded(
    page: Page,
    viewport: { width: number; height: number },
) {
    const dialog = page.getByRole('dialog', { name: 'Pregled galerije' });
    await expect(dialog).toBeVisible();

    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox?.x ?? 0).toBeGreaterThanOrEqual(-1);
    expect(dialogBox?.y ?? 0).toBeGreaterThanOrEqual(-1);
    expect((dialogBox?.width ?? 0) + (dialogBox?.x ?? 0)).toBeLessThanOrEqual(
        viewport.width + 1,
    );
    expect((dialogBox?.height ?? 0) + (dialogBox?.y ?? 0)).toBeLessThanOrEqual(
        viewport.height + 1,
    );

    const viewportOverflow = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
    }));

    expect(viewportOverflow.documentScrollWidth).toBeLessThanOrEqual(
        viewportOverflow.clientWidth + 1,
    );
    expect(viewportOverflow.bodyScrollWidth).toBeLessThanOrEqual(
        viewportOverflow.clientWidth + 1,
    );

    for (const buttonName of [
        'Prethodna slika',
        'Sljedeća slika',
        'Smanji sliku',
        'Uvećaj sliku',
        'Preuzmi sliku',
        'Zatvori pregled galerije',
    ]) {
        await expect(
            page.getByRole('button', { name: buttonName }),
        ).toBeInViewport();
    }
}

test('wide gallery image stays within the desktop viewport while zooming out', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mount(<ImageGallery images={images} />);

    await page.getByRole('button', { name: /Otvori sliku 1/u }).click();

    const zoomOut = page.getByRole('button', { name: 'Smanji sliku' });
    await expect(zoomOut).toBeEnabled();
    await zoomOut.click();

    await expectViewportBounded(page, DESKTOP_VIEWPORT);
});

test('wide gallery image stays within the mobile viewport', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mount(<ImageGallery images={images} />);

    await page.getByRole('button', { name: /Otvori sliku 1/u }).click();

    await expectViewportBounded(page, MOBILE_VIEWPORT);
});
