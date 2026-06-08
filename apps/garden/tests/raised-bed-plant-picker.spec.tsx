import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { PlantPickerTestStory } from './PlantPickerTestStory';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

async function mockShoppingCartPosts(page: Page) {
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

test('plant search keeps keyboard focus while filtering sowing options', async ({
    mount,
    page,
}) => {
    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();

    const searchInput = page.getByPlaceholder('Pretraži...');
    await searchInput.click();
    await searchInput.pressSequentially('raj');

    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue('raj');
    await expect(page.getByRole('button', { name: /Rajčica/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bosiljak/ })).toHaveCount(0);
    await expect(page).not.toHaveURL(/pretraga=/u);

    await searchInput.fill('');
    await searchInput.pressSequentially('paradajz');

    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue('paradajz');
    await expect(page.getByRole('button', { name: /Rajčica/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bosiljak/ })).toHaveCount(0);
});

test('outlet sorts keep planned sowing selected by default', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    await expect(
        sowingMode.getByRole('radio', { name: /Planirano sijanje/ }),
    ).toBeChecked();
    await expect(sowingMode.getByText('Outlet sadnica')).toHaveCount(2);
    await expect(
        page.getByRole('textbox', { name: 'Datum sijanja' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.outletOfferId).toBeUndefined();
    expect(post.entityId).toBe('101');
});

test('outlet sowing sends the selected outlet offer', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    const laterOutletOffer = sowingMode.getByRole('radio', {
        name: /Preostalo 3/,
    });
    await sowingMode.getByText('Preostalo 3').click();
    await expect(laterOutletOffer).toBeChecked();
    await expect(
        page.getByRole('textbox', { name: 'Datum sijanja' }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.outletOfferId).toBe(302);
    expect(post.additionalData).toBe(JSON.stringify({ outletOfferId: 302 }));
});

test('outlet refetch does not replace a missing selected offer', async ({
    mount,
    page,
}) => {
    await mockShoppingCartPosts(page);

    await mount(<PlantPickerTestStory showOutletRefetchControl />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    const laterOutletOffer = sowingMode.getByRole('radio', {
        name: /Preostalo 3/,
    });
    await sowingMode.getByText('Preostalo 3').click();
    await expect(laterOutletOffer).toBeChecked();

    await page.evaluate(() => window.__grediceRemoveOutlet302?.());

    await expect(
        page.getByText('Odabrana outlet sadnica više nije dostupna.'),
    ).toBeVisible();
    await expect(
        sowingMode.getByRole('radio', { name: /Preostalo 2/ }),
    ).not.toBeChecked();
    await expect(
        page.getByRole('textbox', { name: 'Datum sijanja' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru' }),
    ).toBeDisabled();
});

test('mobile sort step keeps the cart action reachable', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const cartAction = page.getByRole('button', { name: 'Dodaj u košaru' });
    await expect(cartAction).toBeVisible();
    await expect(cartAction).toBeInViewport();

    const actions = page.locator('[data-plant-picker-actions]');
    const backAction = actions.getByRole('button', { name: 'Odabir biljke' });
    const actionsBox = await actions.boundingBox();
    const backActionBox = await backAction.boundingBox();
    const cartActionBox = await cartAction.boundingBox();
    expect(actionsBox).not.toBeNull();
    expect(backActionBox).not.toBeNull();
    expect(cartActionBox).not.toBeNull();
    expect(
        Math.abs(
            (backActionBox?.y ?? 0) +
                (backActionBox?.height ?? 0) / 2 -
                ((cartActionBox?.y ?? 0) + (cartActionBox?.height ?? 0) / 2),
        ),
    ).toBeLessThan(12);
    expect(backActionBox?.x ?? 0).toBeLessThan(cartActionBox?.x ?? 0);

    const actionBottom = Math.max(
        (backActionBox?.y ?? 0) + (backActionBox?.height ?? 0),
        (cartActionBox?.y ?? 0) + (cartActionBox?.height ?? 0),
    );
    expect(
        (actionsBox?.y ?? 0) + (actionsBox?.height ?? 0) - actionBottom,
    ).toBeLessThanOrEqual(24);
});

test('mobile sort step scrolls the sowing date clear of sticky actions', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const dateInput = page.getByRole('textbox', { name: 'Datum sijanja' });
    await dateInput.evaluate((element) => {
        let scrollParent = element.parentElement;
        while (scrollParent) {
            const style = window.getComputedStyle(scrollParent);
            if (
                /(auto|scroll)/u.test(style.overflowY) &&
                scrollParent.scrollHeight > scrollParent.clientHeight
            ) {
                scrollParent.scrollTop = scrollParent.scrollHeight;
                return;
            }
            scrollParent = scrollParent.parentElement;
        }
    });

    const actions = page.locator('[data-plant-picker-actions]');
    const dateBox = await dateInput.boundingBox();
    const actionsBox = await actions.boundingBox();
    expect(dateBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect((dateBox?.y ?? 0) + (dateBox?.height ?? 0)).toBeLessThanOrEqual(
        (actionsBox?.y ?? 0) - 12,
    );
});
