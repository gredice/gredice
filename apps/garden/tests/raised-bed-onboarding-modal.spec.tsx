import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    RaisedBedOnboardingModalReopenStory as OnboardingReopenStory,
    RaisedBedOnboardingModalStory as OnboardingStory,
} from './RaisedBedOnboardingModalStory';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const gardenId = 101;
const raisedBedId = 201;

async function mockShoppingCart(page: Page) {
    const posts: unknown[] = [];

    await page.route('**/api/gredice/**/shopping-cart', async (route) => {
        if (route.request().method() === 'POST') {
            posts.push(route.request().postDataJSON());
            await route.fulfill({
                body: JSON.stringify({ success: true }),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        await route.fulfill({
            body: JSON.stringify({
                allowPurchase: true,
                hasDeliverableItems: false,
                id: 1,
                items: [],
                notes: [],
                total: 0,
                totalSunflowers: 0,
            }),
            contentType: 'application/json',
            status: 200,
        });
    });

    return posts;
}

test('raised-bed onboarding uses a near full-screen desktop modal', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    const dialog = page.getByRole('dialog', { name: 'Brzi plan gredice' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Brzi plan sadnje');
    await expect(dialog).toContainText('Prva gredica');
    await expect(dialog).not.toContainText('Tvoji zadaci');

    const dialogBox = await dialog.boundingBox();
    expect(dialogBox?.width).toBeGreaterThan(1000);
    expect(dialogBox?.height).toBeGreaterThan(700);
});

test('raised-bed onboarding reopens from the first-bed HUD trigger', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingReopenStory />);

    await expect(
        page.getByRole('dialog', { name: 'Brzi plan gredice' }),
    ).toBeHidden();
    await page.getByRole('button', { name: 'Prva gredica' }).click();
    await expect(
        page.getByRole('dialog', { name: 'Brzi plan gredice' }),
    ).toBeVisible();
});

test('raised-bed onboarding previews vertical sort-image layouts', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();
    await expect(page.getByText('Odaberi raspored')).toBeVisible();
    await expect(
        page.locator('img[alt="Rajčica saint pierre"]').first(),
    ).toBeVisible();

    const previewBox = await page
        .locator('div[title^="Rajčica saint pierre"]')
        .first()
        .locator('xpath=ancestor::div[contains(@class, "grid-cols-3")][1]')
        .boundingBox();
    expect(previewBox).not.toBeNull();
    expect(previewBox?.height ?? 0).toBeGreaterThan(previewBox?.width ?? 0);
});

test('raised-bed onboarding fills the mobile viewport', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    const dialog = page.getByRole('dialog', { name: 'Brzi plan gredice' });
    await expect(dialog).toBeVisible();

    const layoutViewport = await page.evaluate(() => ({
        height: document.documentElement.clientHeight,
        width: document.documentElement.clientWidth,
    }));
    await expect
        .poll(async () => (await dialog.boundingBox())?.width ?? 0)
        .toBeGreaterThanOrEqual(layoutViewport.width - 1);
    await expect
        .poll(async () => (await dialog.boundingBox())?.height ?? 0)
        .toBeGreaterThanOrEqual(layoutViewport.height - 1);
});

test('raised-bed onboarding applies twelve suggested cart plants', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const posts = await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    const dialog = page.getByRole('dialog', { name: 'Brzi plan gredice' });
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();
    await expect(page.getByText('Odaberi raspored')).toBeVisible();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await expect(page.getByText('Tvoji zadaci')).toBeVisible();
    await page.getByRole('button', { name: 'Dodaj plan u košaru' }).click();

    await expect.poll(() => posts.length).toBe(12);
    expect(posts).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                amount: 1,
                currency: 'eur',
                entityTypeName: 'plantSort',
                gardenId,
                raisedBedId,
            }),
        ]),
    );
    expect(
        new Set(
            posts
                .filter(
                    (post): post is { positionIndex: number } =>
                        typeof post === 'object' &&
                        post !== null &&
                        typeof Reflect.get(post, 'positionIndex') === 'number',
                )
                .map((post) => post.positionIndex),
        ).size,
    ).toBe(12);
});

test('raised-bed onboarding applies the current preference default layout', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const posts = await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    const dialog = page.getByRole('dialog', { name: 'Brzi plan gredice' });
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: /Umaci i roštilj/ }).click();
    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();
    await expect(page.getByText('Odaberi raspored')).toBeVisible();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Dodaj plan u košaru' }).click();

    await expect.poll(() => posts.length).toBe(12);

    const entityIds = posts
        .map((post) =>
            typeof post === 'object' && post !== null
                ? Reflect.get(post, 'entityId')
                : null,
        )
        .filter((entityId): entityId is string => typeof entityId === 'string');

    expect(entityIds).toContain('216');
    expect(entityIds).toContain('230');
    expect(entityIds).not.toContain('357');
});
