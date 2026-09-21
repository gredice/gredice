import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { PublicGardenMembersHarness } from './PublicGardenMembersHarness';

const members = [
    'Ana Kovač',
    'Marko Marić',
    'Petra Horvat',
    'Iva Novak',
    'Veseli vrtlar s vrlo dugim imenom',
    'Korisnik Gredica',
].map((displayName, index) => ({
    publicId: `u_member${index}`,
    displayName,
    avatarUrl:
        index === 0
            ? 'https://cdn.gredice.com/avatars/farmer-female.png'
            : null,
    achievementCount: index * 3,
}));

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-09-21T12:00:00Z'));
    await page.route('**/api/public-environment/debug', (route) =>
        route.fulfill({ json: { enabled: false } }),
    );
    await page.route('**/api/data/weather/now', (route) =>
        route.fulfill({
            json: { cloudy: 0, foggy: 0, rainy: 0, snowy: 0, thundery: 0 },
        }),
    );
    await page.route('**/api/auth/current-claims**', (route) =>
        route.fulfill({ status: 401, json: {} }),
    );
});

for (const width of [390, 768, 1280]) {
    test(`member stack and complete named list remain accessible at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await mount(<PublicGardenMembersHarness members={members} />);
        const card = page.getByTestId('garden-card');
        const details = page.getByRole('region', { name: 'Detalji vrta' });
        const avatars = card.getByRole('link', { name: /Otvori profil/ });
        await expect(avatars).toHaveCount(4);
        await expect(avatars.first()).toHaveAttribute(
            'href',
            '/korisnici/u_member0',
        );
        await expect(
            card.getByRole('link', { name: 'Prikaži sve vrtlare, još 2' }),
        ).toHaveAttribute('href', '/vrtovi/59#vrtlari');
        await expect(details.getByRole('link')).toHaveCount(6);
        await expect(details.getByRole('link').last()).toHaveAttribute(
            'href',
            '/korisnici/u_member5',
        );
        await expect(page.locator('a a')).toHaveCount(0);
        await page.keyboard.press('Tab');
        await expect(
            card.getByRole('link', { name: 'Otvori vrt Zajednički vrt' }),
        ).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(avatars.first()).toBeFocused();
        await expect(avatars.first()).toHaveCSS('outline-style', 'solid');
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
        await page.screenshot({
            path: `/tmp/gredice-garden-members-${width}.png`,
            fullPage: true,
        });
    });
}

test('avatar clicks reach the profile instead of the garden overlay', async ({
    mount,
    page,
}) => {
    await mount(<PublicGardenMembersHarness members={members} />);
    // Record the actual anchor receiving the click without leaving the fixture.
    await page.evaluate(() => {
        document.addEventListener(
            'click',
            (event) => {
                if (event.target instanceof Element) {
                    document.body.dataset.clickedHref =
                        event.target.closest('a')?.getAttribute('href') ?? '';
                }
                event.preventDefault();
            },
            { capture: true },
        );
    });
    const card = page.getByTestId('garden-card');
    await card.getByRole('link', { name: /Otvori profil: Ana/ }).click();
    await expect(page.locator('body')).toHaveAttribute(
        'data-clicked-href',
        '/korisnici/u_member0',
    );
    await card
        .getByRole('link', { name: 'Otvori vrt Zajednički vrt' })
        .click({ position: { x: 180, y: 130 } });
    await expect(page.locator('body')).toHaveAttribute(
        'data-clicked-href',
        '/vrtovi/59',
    );
});

test('empty membership hides the section and older list responses retain the owner avatar', async ({
    mount,
    page,
}) => {
    const component = await mount(<PublicGardenMembersHarness members={[]} />);
    await expect(page.getByRole('list', { name: 'Vrtlari' })).toHaveCount(0);
    await component.update(
        <PublicGardenMembersHarness members={members} legacyResponse />,
    );
    await expect(
        page
            .getByTestId('garden-card')
            .getByRole('link', { name: /Otvori profil/ }),
    ).toHaveCount(1);
    await expect(
        page
            .getByTestId('garden-card')
            .getByRole('link', { name: /Otvori profil/ }),
    ).toHaveAttribute('href', '/korisnici/u_member0');
});
