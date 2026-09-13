import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import type { LandingGardenCandidate } from '../app/landingGardenCarousel';
import { AvatarProfileLinksHarness } from './AvatarProfileLinksHarness';

const featuredGardens: LandingGardenCandidate[] = [
    {
        garden: {
            id: 1,
            name: 'Anin vrt',
            backgroundPalette: 'current',
            farmId: 1,
            homeCamera: null,
            isPublic: true,
            isSandbox: false,
            latitude: 45.815,
            longitude: 15.982,
            raisedBeds: [],
            stacks: {},
            structures: [],
            updatedAt: '2026-09-12T00:00:00.000Z',
        },
        owner: { publicId: 'u_ana', displayName: 'Ana Kovač', avatarUrl: null },
    },
];
const otherGarden: LandingGardenCandidate = {
    garden: { ...featuredGardens[0].garden, id: 2, name: 'Markov vrt' },
    owner: { publicId: 'u_marko', displayName: 'Marko Marić', avatarUrl: null },
};
const currentUser = {
    id: 'test-user',
    publicId: 'u_current',
    displayName: 'Veseli vrtlar',
    userName: 'private@example.com',
};

test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/current-claims**', (route) =>
        route.fulfill({ status: 401, json: {} }),
    );
    await page.route('**/api/gardens', (route) => route.fulfill({ json: [] }));
});

test('links the displayed garden owner and updates the link when the garden changes', async ({
    mount,
    page,
}) => {
    await mount(
        <AvatarProfileLinksHarness
            featuredGardens={[...featuredGardens, otherGarden]}
        />,
    );
    const ownerLink = page.getByRole('link', {
        name: 'Otvori profil: Ana Kovač',
    });
    await expect(ownerLink).toHaveAttribute('href', '/korisnici/u_ana');
    await page.keyboard.press('Tab');
    await expect(
        page.getByRole('link', { name: 'Moj novi vrt' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(ownerLink).toBeFocused();
    await expect(ownerLink).toHaveCSS('outline-style', 'solid');
    await page.getByRole('button', { name: 'Sljedeći vrt' }).click();
    await expect(
        page.getByRole('link', { name: 'Otvori profil: Marko Marić' }),
    ).toHaveAttribute('href', '/korisnici/u_marko');
    await expect(ownerLink).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('keeps the signed-in avatar profile separate from the featured owner and garden entry', async ({
    mount,
    page,
}) => {
    await page.route('**/api/auth/current-claims**', (route) =>
        route.fulfill({ json: currentUser }),
    );
    await mount(
        <AvatarProfileLinksHarness featuredGardens={featuredGardens} />,
    );
    const header = page.locator('header');
    await expect(
        header.getByRole('link', { name: 'Otvori profil: Veseli vrtlar' }),
    ).toHaveAttribute('href', '/korisnici/u_current');
    await expect(
        header.getByRole('link', { name: 'Moj vrt', exact: true }),
    ).toHaveAttribute('href', 'https://vrt.gredice.com/');
    await expect(
        page.getByRole('link', { name: 'Otvori profil: Ana Kovač' }),
    ).toHaveAttribute('href', '/korisnici/u_ana');
    await expect(page.locator('a a')).toHaveCount(0);
    await page.screenshot({
        path: '/tmp/gredice-avatar-links-desktop.png',
        fullPage: true,
    });
});

test('links owned gardens to the current user profile on mobile', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/auth/current-claims**', (route) =>
        route.fulfill({ json: currentUser }),
    );
    await page.route('**/api/gardens', (route) =>
        route.fulfill({ json: [{ id: 3 }] }),
    );
    await page.route('**/api/gardens/3', (route) =>
        route.fulfill({
            json: {
                ...featuredGardens[0].garden,
                id: 3,
                name: 'Moj povrtnjak',
            },
        }),
    );
    await mount(
        <AvatarProfileLinksHarness featuredGardens={featuredGardens} />,
    );
    const carousel = page.getByTestId('landing-featured-gardens');
    await expect(carousel).toHaveAttribute('data-garden-source', 'owned');
    await expect(
        carousel.getByRole('link', { name: 'Otvori profil: Veseli vrtlar' }),
    ).toHaveAttribute('href', '/korisnici/u_current');
    await expect(
        carousel.getByRole('link', { name: 'Otvori', exact: true }),
    ).toHaveAttribute('href', /[?&]vrt=3(?:&|$)/u);
    await expect(page.getByText('Tvoj vrt', { exact: true })).toBeVisible();
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
        path: '/tmp/gredice-avatar-links-mobile.png',
        fullPage: true,
    });
});

test('preserves plain avatars when cached responses have no public ID', async ({
    mount,
    page,
}) => {
    await page.route('**/api/auth/current-claims**', (route) =>
        route.fulfill({ json: { ...currentUser, publicId: undefined } }),
    );
    await mount(
        <AvatarProfileLinksHarness
            featuredGardens={[
                {
                    ...featuredGardens[0],
                    owner: { displayName: 'Ana Kovač', avatarUrl: null },
                },
            ]}
        />,
    );
    await expect(page.getByText('VV', { exact: true })).toBeVisible();
    await expect(page.getByText('AK', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Otvori profil/ })).toHaveCount(
        0,
    );
});

test('uses the www origin for the shared header outside the main website', async ({
    mount,
    page,
}) => {
    await page.route('**/api/auth/current-claims**', (route) =>
        route.fulfill({ json: currentUser }),
    );
    await mount(
        <AvatarProfileLinksHarness
            featuredGardens={[]}
            linkMode="www-origin"
        />,
    );
    await expect(
        page.getByRole('link', { name: 'Otvori profil: Veseli vrtlar' }),
    ).toHaveAttribute('href', 'http://localhost:3000/korisnici/u_current');
});
