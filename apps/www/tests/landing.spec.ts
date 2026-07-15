import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.describe.configure({ mode: 'default' });

async function expectPillBorderRadius(locator: Locator) {
    await expect
        .poll(async () =>
            locator.evaluate((element) => {
                const styles = window.getComputedStyle(element);
                const radii = [
                    styles.borderTopLeftRadius,
                    styles.borderTopRightRadius,
                    styles.borderBottomRightRadius,
                    styles.borderBottomLeftRadius,
                ].map((radius) => Number.parseFloat(radius));
                const { height } = element.getBoundingClientRect();

                return Math.min(...radii) - height / 2;
            }),
        )
        .toBeGreaterThanOrEqual(0);
}

async function expectMobileNavActionsDoNotOverlap(page: Page) {
    const cta = page.getByRole('link', { name: 'Moj novi vrt' });
    const menuButton = page.getByRole('button', {
        name: /Otvori navigaciju|Zatvori navigaciju/u,
    });

    await expect(cta).toBeVisible();
    await expect(menuButton).toBeVisible();

    await expect
        .poll(
            async () => {
                const ctaBox = await cta.boundingBox();
                const menuButtonBox = await menuButton.boundingBox();
                if (!ctaBox || !menuButtonBox) {
                    return Number.NEGATIVE_INFINITY;
                }

                return menuButtonBox.x - (ctaBox.x + ctaBox.width);
            },
            { timeout: 15_000 },
        )
        .toBeGreaterThan(0);
    await expect
        .poll(
            async () => {
                const ctaBox = await cta.boundingBox();
                return ctaBox?.width ?? Number.POSITIVE_INFINITY;
            },
            { timeout: 15_000 },
        )
        .toBeLessThanOrEqual(56);
}

test('has title', async ({ page }) => {
    // The first `/` hit in a shard pays the Next.js SSR cold-start cost,
    // which can exceed the 10s default test timeout. Triple it.
    test.slow();
    await page.goto('/');
    await expect(page).toHaveTitle(/Gredice/);
});

test('mobile navbar closes after navigating from the menu', async ({
    page,
}) => {
    test.slow();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/kontakt');
    await expectMobileNavActionsDoNotOverlap(page);

    const menuButton = page.getByRole('button', {
        name: 'Otvori navigaciju',
    });
    await menuButton.click();

    const mobileNav = page.getByRole('navigation', {
        name: 'Glavna navigacija',
    });
    await expect(mobileNav).toBeVisible();

    await mobileNav.getByRole('link', { name: 'Česta pitanja' }).click();

    await expect(page).toHaveURL(/\/cesta-pitanja/u);
    await expect(mobileNav).toBeHidden();
    await expect(
        page.getByRole('button', { name: 'Otvori navigaciju' }),
    ).toBeVisible();
});

test('navbar floats on scroll and landing game frame is rounded', async ({
    page,
}, testInfo) => {
    test.slow();
    testInfo.setTimeout(90_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const header = page.locator('header');
    await expect(header).toHaveCSS('border-bottom-width', '0px');

    await expect(page.getByTestId('landing-game-frame')).toHaveCSS(
        'border-radius',
        '24px',
    );
    await expect(page.getByTestId('landing-hero-card')).toHaveCSS(
        'border-radius',
        '15px',
    );
    await expect(
        page
            .getByTestId('landing-game-frame')
            .locator('[style*="linear-gradient"]'),
    ).toHaveCount(0);

    const frameBox = await page.getByTestId('landing-game-frame').boundingBox();
    const heroCardBox = await page
        .getByTestId('landing-hero-card')
        .boundingBox();
    expect(frameBox).not.toBeNull();
    expect(heroCardBox).not.toBeNull();
    if (!frameBox || !heroCardBox) {
        throw new Error('Expected landing game frame and hero card boxes.');
    }

    expect(heroCardBox.x - frameBox.x).toBeGreaterThanOrEqual(23);
    expect(heroCardBox.y - frameBox.y).toBeGreaterThanOrEqual(31);
    expect(heroCardBox.width).toBeLessThan(frameBox.width - 48);
    expect(frameBox.height).toBeLessThanOrEqual(550);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 35_000 });

    const signupCta = page.getByTestId('landing-game-signup-cta');
    await expect(signupCta).toBeVisible();
    await expect(
        signupCta.getByRole('link', { name: 'Započni svoj vrt' }),
    ).toBeVisible();
    await expect(
        signupCta.getByRole('link', { name: 'Otvori aplikaciju' }),
    ).toBeVisible();

    const signupCtaBox = await signupCta.boundingBox();
    expect(signupCtaBox).not.toBeNull();
    if (!signupCtaBox) {
        throw new Error('Expected landing game signup CTA box.');
    }

    expect(signupCtaBox.y).toBeGreaterThanOrEqual(frameBox.y + frameBox.height);

    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const profile = (
                        window as Window & {
                            __grediceGameProfile?: {
                                dprCap?: number;
                                qualityTier?: string;
                            };
                        }
                    ).__grediceGameProfile;

                    return {
                        dprCap: profile?.dprCap,
                        qualityTier: profile?.qualityTier,
                    };
                }),
            { timeout: 15_000 },
        )
        .toEqual({ dprCap: 2, qualityTier: 'high' });

    const canvas = page.locator('canvas');
    const countVisibleCanvasPixels = async () => {
        const screenshot = await canvas.screenshot({ scale: 'css' });

        return page.evaluate(async (base64) => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();

            const sampleCanvas = document.createElement('canvas');
            sampleCanvas.width = 20;
            sampleCanvas.height = 20;
            const context = sampleCanvas.getContext('2d');
            if (!context) {
                return 0;
            }

            context.drawImage(image, 0, 0, 20, 20);
            const pixels = context.getImageData(0, 0, 20, 20).data;
            let visiblePixels = 0;
            for (let index = 0; index < pixels.length; index += 4) {
                const red = pixels[index] ?? 0;
                const green = pixels[index + 1] ?? 0;
                const blue = pixels[index + 2] ?? 0;
                const alpha = pixels[index + 3] ?? 0;
                if (alpha > 0 && red + green + blue > 0) {
                    visiblePixels += 1;
                }
            }

            return visiblePixels;
        }, screenshot.toString('base64'));
    };
    await expect
        .poll(countVisibleCanvasPixels, { timeout: 35_000 })
        .toBeGreaterThan(10);

    await page.evaluate(() => window.scrollTo(0, 160));
    await expectPillBorderRadius(header);
    await expect(header).toHaveCSS('border-bottom-width', '1px');
    await expectMobileNavActionsDoNotOverlap(page);

    await expect
        .poll(async () => {
            const mobileHeaderBox = await header.boundingBox();
            return mobileHeaderBox?.x ?? Number.NEGATIVE_INFINITY;
        })
        .toBeGreaterThanOrEqual(7);
    await expect
        .poll(async () => {
            const mobileHeaderBox = await header.boundingBox();
            return mobileHeaderBox?.y ?? Number.NEGATIVE_INFINITY;
        })
        .toBeGreaterThanOrEqual(7);
});

test('desktop floating navbar keeps its width and balanced CTA spacing', async ({
    page,
}) => {
    test.slow();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const header = page.locator('header');
    const gardenCta = page.getByRole('link', { name: 'Moj novi vrt' });
    const gardenCtaIcon = gardenCta.locator('svg:visible').last();

    await expect
        .poll(
            async () => {
                const [buttonBox, iconBox] = await Promise.all([
                    gardenCta.boundingBox(),
                    gardenCtaIcon.boundingBox(),
                ]);
                if (!buttonBox || !iconBox) {
                    return Number.POSITIVE_INFINITY;
                }

                const trailingSpace =
                    buttonBox.x + buttonBox.width - (iconBox.x + iconBox.width);
                const verticalSpace = (buttonBox.height - iconBox.height) / 2;

                return Math.abs(trailingSpace - verticalSpace);
            },
            { timeout: 15_000 },
        )
        .toBeLessThanOrEqual(0.5);

    await page.evaluate(() => window.scrollTo(0, 160));
    await expectPillBorderRadius(header);

    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    if (!headerBox) {
        throw new Error('Expected desktop navbar to have a bounding box.');
    }

    expect(headerBox.width).toBeLessThanOrEqual(1280);
    expect(headerBox.x).toBeGreaterThanOrEqual(70);
});

test('logged-in landing game morphs into full screen in place', async ({
    page,
}) => {
    test.slow();

    await page.unroute('**/api/gredice/api/auth/current-claims**');
    await page.route(
        '**/api/gredice/api/auth/current-claims**',
        async (route) => {
            await route.fulfill({
                body: JSON.stringify({
                    id: 'test-user',
                    userName: 'test',
                    displayName: 'Test User',
                    avatarUrl: null,
                }),
                contentType: 'application/json',
                status: 200,
            });
        },
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const scene = page.getByTestId('landing-game-scene');
    const initialBox = await scene.boundingBox();
    expect(initialBox).not.toBeNull();

    await page.getByRole('button', { name: 'Pogledaj moj vrt ovdje' }).click();

    await expect(scene).toHaveCSS('border-radius', '0px', {
        timeout: 1200,
    });
    await page.waitForTimeout(800);

    const expandedBox = await scene.boundingBox();
    expect(expandedBox).not.toBeNull();
    if (!expandedBox) {
        throw new Error('Expected expanded landing game to have a box.');
    }

    expect(expandedBox.x).toBeLessThanOrEqual(1);
    expect(expandedBox.y).toBeLessThanOrEqual(1);
    expect(expandedBox.width).toBeGreaterThanOrEqual(389);
    expect(expandedBox.height).toBeGreaterThanOrEqual(843);
});
