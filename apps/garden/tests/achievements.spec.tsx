import { expect, test } from '@playwright/experimental-ct-react';
import { AchievementCollectionShowcase } from '../../../packages/game/src/shared-ui/achievements/AchievementCollection.fixture';

test('the public guide stays accessible when personal achievements cannot load', async ({
    mount,
    page,
}) => {
    await page.route('**/api/accounts/current/achievements', (route) =>
        route.fulfill({ status: 503, json: {} }),
    );
    await mount(<AchievementCollectionShowcase unseeded showGuide />);
    await expect(
        page.getByText('Postignuća trenutno nisu dostupna.'),
    ).toBeVisible();
    const guide = page.getByRole('link', { name: /Vodič kroz sva postignuća/ });
    await expect(guide).toBeVisible();
    await expect(guide).toHaveAttribute(
        'href',
        'https://www.gredice.com/postignuca',
    );
    await expect(guide).toHaveAttribute('target', '_blank');
    await guide.focus();
    await expect(guide).toBeFocused();
});

for (const { name: family, count } of [
    { name: 'Raznolik vrt', count: 10 },
    { name: 'Od sjemena do stola', count: 10 },
    { name: 'Sezona za pamćenje', count: 3 },
    { name: 'Doprinos zajednici', count: 13 },
    { name: 'Zalijevanje', count: 13 },
]) {
    test(`loads distinct artwork for every level in ${family}`, async ({
        mount,
        page,
    }) => {
        await mount(<AchievementCollectionShowcase state="empty" />);
        await page
            .getByRole('button', { name: new RegExp(`^${family}`) })
            .click();
        const dialog = page.getByRole('dialog', { name: family });
        await expect(dialog.locator('[data-achievement-level]')).toHaveCount(
            count,
        );
        await expect(
            dialog.locator('[data-achievement-placeholder]'),
        ).toHaveCount(0);
        const artwork = await dialog
            .locator('[data-achievement-level] image')
            .evaluateAll(async (images) =>
                Promise.all(
                    images.map(async (element) => {
                        const image = new Image();
                        image.src = element.getAttribute('href') ?? '';
                        await image.decode();
                        return {
                            url: image.src,
                            width: image.naturalWidth,
                            height: image.naturalHeight,
                        };
                    }),
                ),
            );
        expect(new Set(artwork.map((image) => image.url)).size).toBe(count);
        expect(
            artwork.every(
                (image) => image.width === 512 && image.height === 512,
            ),
        ).toBe(true);
        await expect(
            dialog.locator('[data-achievement-state="approved"]'),
        ).toHaveCount(0);
    });
}

test('opens all levels, distinguishes pending awards and restores keyboard focus', async ({
    mount,
    page,
}) => {
    await mount(<AchievementCollectionShowcase allowAccountReset />);
    const planting = page.getByRole('button', { name: /^Sadnja/ });
    await expect(planting).toContainText('Razina IV / IX');
    await expect(planting).toContainText('Na potvrdi: 1');
    await planting.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Sadnja' });
    await expect(dialog.locator('[data-achievement-level]')).toHaveCount(9);
    await expect(dialog.locator('[data-achievement-level="5"]')).toContainText(
        'Čeka potvrdu',
    );
    await expect(dialog.locator('[data-achievement-level="6"]')).toContainText(
        'Uvjet nije potvrđen',
    );
    await expect(dialog.locator('[data-achievement-level="7"]')).toContainText(
        'Još nije ostvareno',
    );
    await expect(dialog.locator('[data-achievement-level="4"]')).toContainText(
        'Primljeno 750 suncokreta',
    );
    expect(
        await dialog.locator('image').evaluateAll(async (elements) =>
            Promise.all(
                elements.map(async (element) => {
                    const image = new Image();
                    image.src = element.getAttribute('href') ?? '';
                    await image.decode();
                    return image.naturalWidth;
                }),
            ),
        ),
    ).toEqual(Array(10).fill(512));
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(planting).toBeFocused();
    await page.getByRole('button', { name: 'Prikaži novi račun' }).click();
    await expect(planting).toContainText('Prvo postignuće te čeka');
    await expect(planting).not.toContainText('Na potvrdi:');
    await planting.click();
    await expect(
        page.getByRole('dialog').locator('[data-achievement-state="approved"]'),
    ).toHaveCount(0);
});

test('shows a known first requirement for an empty account and fits a 320px viewport', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(<AchievementCollectionShowcase state="empty" dark />);
    await expect(page.locator('[data-achievement-family]')).toHaveCount(8);
    await expect(
        page.getByRole('button', { name: /^Raznolik vrt/ }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /^Od sjemena do stola/ }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /^Sezona za pamćenje/ }),
    ).toBeVisible();
    const watering = page.getByRole('button', { name: /^Zalijevanje/ });
    await expect(watering).toContainText('Sljedeće: Prvo zalijevanje');
    await watering.click();
    const dialog = page.getByRole('dialog', { name: 'Zalijevanje' });
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByText('Zalij biljke 1 puta.', { exact: true }),
    ).toBeVisible();
    expect(
        await dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
    ).toBe(true);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
});

test('complete families feature their legendary award and have no next requirement', async ({
    mount,
    page,
}) => {
    await mount(<AchievementCollectionShowcase state="complete" />);
    const harvest = page.getByRole('button', { name: /^Berba/ });
    await expect(
        harvest.locator('[data-achievement-key="harvest_500"]'),
    ).toBeVisible();
    await expect(harvest).toContainText('Razina IX / IX');
    await expect(harvest).toContainText('Sve razine ostvarene');
    await expect(harvest).not.toContainText('Sljedeće:');
});

test('announces the highest new approval once and clears it on account change', async ({
    mount,
    page,
}) => {
    await mount(
        <AchievementCollectionShowcase allowApproval allowAccountReset />,
    );
    await expect(page.locator('[data-achievement-reveal]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Potvrdi nove razine' }).click();
    await expect(
        page.locator('[data-achievement-reveal="community_edit_1500"]'),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
        'Još novih postignuća:',
    );
    await page
        .getByRole('button', { name: 'Zatvori obavijest o postignuću' })
        .click();
    await page.getByRole('button', { name: 'Potvrdi nove razine' }).click();
    await expect(page.locator('[data-achievement-reveal]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Prikaži novi račun' }).click();
    await expect(page.locator('[data-achievement-reveal]')).toHaveCount(0);
});

test('shows loading and recovers from an HTTP error using the real query', async ({
    mount,
    page,
}) => {
    let resolve: () => void = () => undefined;
    const pending = new Promise<void>((done) => {
        resolve = done;
    });
    let requests = 0;
    await page.route('**/api/accounts/current/achievements', async (route) => {
        requests += 1;
        if (requests === 1) {
            await pending;
            await route.fulfill({
                status: 500,
                json: { error: 'Unavailable' },
            });
        } else await route.fulfill({ json: { achievements: [] } });
    });
    await mount(<AchievementCollectionShowcase unseeded />);
    await expect(
        page.getByRole('img', { name: 'Učitavanje postignuća' }),
    ).toBeVisible();
    resolve();
    await expect(page.getByRole('alert')).toContainText(
        'Postignuća trenutno nisu dostupna.',
    );
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(page.locator('[data-achievement-family]')).toHaveCount(8);
    expect(requests).toBe(2);
});

test('separates approved awards from uncredited rewards and respects zero overrides', async ({
    mount,
    page,
}) => {
    await mount(<AchievementCollectionShowcase />);
    await page.getByRole('button', { name: /^Zalijevanje/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-achievement-level="4"]')).toContainText(
        'Nagrada se obrađuje: 600 suncokreta',
    );
    await expect(dialog.locator('[data-achievement-level="3"]')).toContainText(
        'Bez nagrade u suncokretima',
    );
    await expect(dialog).not.toContainText('Primljeno');
    await expect(dialog.locator('[data-achievement-level="4"]')).toContainText(
        'Potvrđeno:',
    );
});
