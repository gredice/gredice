import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { PublicProfileHarness } from './PublicProfileHarness';

const gardens = [
    { id: 1, name: 'Povrtnjak', createdAt: '2026-01-01' },
    { id: 2, name: 'Cvjetni vrt', createdAt: '2026-01-01' },
    { id: 3, name: 'Začinsko bilje', createdAt: '2026-01-01' },
];
const gardenDetails = gardens.map((garden, index) => ({
    ...garden,
    likeCount: 7 + index,
    raisedBeds: [
        {
            fields: [
                { active: true, plantSortId: 1 },
                { active: index > 0, plantSortId: 2 },
                { active: true, plantSortId: null },
                { active: false, plantSortId: 3 },
            ],
        },
    ],
    stacks: {
        '0': { '0': [{ id: 'grass', name: 'Block_Grass', rotation: 0 }] },
    },
}));
const profile = {
    user: {
        displayName: 'Veseli vrtlar',
        userName: 'private@example.com',
        avatarUrl: null,
        createdAt: '2026-03-12T08:00:00.000Z',
    },
    gardens,
    achievements: [
        { key: 'registration', status: 'approved' },
        { key: 'planting_1', status: 'approved' },
        { key: 'planting_20', status: 'approved' },
        { key: 'watering_20', status: 'approved' },
        { key: 'watering_1', status: 'approved' },
        { key: 'harvest_20', status: 'approved' },
        { key: 'harvest_50', status: 'pending' },
    ],
};

test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-12T12:00:00.000Z'));
    await page.route('**/api/auth/current-claims**', (route) =>
        route.fulfill({ json: null }),
    );
    await page.route('**/api/directories/entities/block**', (route) =>
        route.fulfill({
            json: [
                {
                    information: { name: 'Block_Grass' },
                    attributes: {},
                    prices: { sunflowers: 2 },
                },
            ],
        }),
    );
    await page.route('**/api/users/public/test-profile/profile', (route) =>
        route.fulfill({ json: profile }),
    );
    await page.route('**/api/gardens/*/public', (route) => {
        const id = Number(route.request().url().split('/').at(-2));
        return route.fulfill({
            json: gardenDetails.find((garden) => garden.id === id),
        });
    });
});

test('shows trophy milestones and visible gardens without exposing the login name', async ({
    mount,
    page,
}) => {
    await mount(<PublicProfileHarness />);
    await expect(
        page.getByRole('heading', { name: 'Veseli vrtlar' }),
    ).toBeVisible();
    await expect(page.getByText('private@example.com')).toHaveCount(0);
    await expect(page.getByText('VV', { exact: true })).toBeVisible();
    await expect(page.getByText('Korisnik već 6 mjeseci')).toBeVisible();
    await expect(page.getByText(/vrtova|bez HUD-a/)).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(3);
    const achievements = page.getByRole('region', { name: 'Postignuća' });
    await expect(achievements.getByRole('listitem')).toHaveCount(4);
    await expect(achievements.getByText('🏆')).toHaveCount(4);
    await expect(
        achievements.getByRole('heading', { name: '20 biljaka' }),
    ).toBeVisible();
    await expect(achievements.getByText('Prvo sjeme')).toHaveCount(0);
    await expect(achievements.getByText('50 berbi')).toHaveCount(0);
    await expect(achievements).toHaveCSS('text-align', 'center');
    const badges = await achievements.getByRole('listitem').all();
    const firstBadge = await badges[0].boundingBox();
    const lastBadge = await badges[3].boundingBox();
    const section = await achievements.boundingBox();
    if (!firstBadge || !lastBadge || !section)
        throw new Error('Expected achievement layout');
    expect(
        Math.abs(
            (firstBadge.x + lastBadge.x + lastBadge.width) / 2 -
                (section.x + section.width / 2),
        ),
    ).toBeLessThan(1);
    const selectedGarden = page
        .getByRole('radio', { name: 'Povrtnjak' })
        .locator('..')
        .locator('span');
    expect(
        await selectedGarden.evaluate(
            (element) => getComputedStyle(element).borderColor,
        ),
    ).toBe(
        await page
            .locator('#profile-garden-preview')
            .evaluate((element) => getComputedStyle(element).borderColor),
    );
    const details = page.getByRole('region', { name: 'Vrt: Povrtnjak' });
    await expect(details.getByText('Biljaka').locator('..')).toContainText('1');
    await expect(
        details.getByRole('button', { name: 'Prijavi se za lajk' }),
    ).toHaveText('7');
    await details.getByRole('button', { name: /Statistika vrta/ }).click();
    await expect(details.getByText('1 m²')).toBeVisible();
    await expect(details.getByText('2 🌻')).toBeVisible();
    await expect(details.locator('[data-collapse-state="open"]')).toHaveCSS(
        'opacity',
        '1',
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
        path: '/tmp/gredice-profile-desktop.png',
        fullPage: true,
    });
});

test('switches the preview with keyboard selection and keeps the scene mounted', async ({
    mount,
    page,
}) => {
    await mount(<PublicProfileHarness />);
    const scene = page.getByTestId('garden-scene');
    await expect(scene).toHaveAttribute('data-garden-id', '1');
    await scene.evaluate((element) =>
        element.setAttribute('data-mounted', 'original'),
    );
    await page.getByRole('radio', { name: 'Povrtnjak' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(
        page.getByRole('radio', { name: 'Cvjetni vrt' }),
    ).toBeChecked();
    await expect(scene).toHaveAttribute('data-garden-id', '2');
    await expect(scene).toHaveAttribute('data-mounted', 'original');
    await expect(
        page.getByRole('region', { name: 'Vrt: Cvjetni vrt' }),
    ).toHaveAttribute('aria-busy', 'false');
    const details = page.getByRole('region', { name: 'Vrt: Cvjetni vrt' });
    await expect(details.getByText('Biljaka').locator('..')).toContainText('2');
    await expect(
        details.getByRole('button', { name: 'Prijavi se za lajk' }),
    ).toHaveText('8');
});

test('shows the selected profile image instead of initials', async ({
    mount,
    page,
}) => {
    await page.route('**/test-avatar.svg', (route) =>
        route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="24" fill="green"/></svg>',
        }),
    );
    await page.route('**/api/users/public/test-profile/profile', (route) =>
        route.fulfill({
            json: {
                ...profile,
                user: { ...profile.user, avatarUrl: '/test-avatar.svg' },
            },
        }),
    );
    await mount(<PublicProfileHarness />);
    const avatar = page.getByRole('img', { name: 'Veseli vrtlar' });
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveJSProperty('naturalWidth', 48);
    await expect(page.getByText('VV', { exact: true })).toHaveCount(0);
});

test('keeps garden facts available if optional block statistics cannot load', async ({
    mount,
    page,
}) => {
    await page.route('**/api/directories/entities/block**', (route) =>
        route.fulfill({ status: 503, json: {} }),
    );
    await mount(<PublicProfileHarness />);
    const details = page.getByRole('region', { name: 'Vrt: Povrtnjak' });
    await expect(details.getByText('Biljaka').locator('..')).toContainText('1');
    await expect(
        details.getByRole('button', { name: 'Prijavi se za lajk' }),
    ).toHaveText('7');
    await expect(
        details.getByRole('button', { name: /Statistika vrta/ }),
    ).toHaveCount(0);
});

test('keeps a pending like on its original garden while switching gardens', async ({
    mount,
    page,
}) => {
    await page.route('**/api/auth/current-claims**', (route) =>
        route.fulfill({
            json: {
                id: 'test-user',
                displayName: 'Posjetitelj',
                userName: 'test',
            },
        }),
    );
    await page.route('**/api/gardens/likes', (route) =>
        route.fulfill({ json: { gardenIds: [] } }),
    );
    let release = () => {};
    const blocked = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/gardens/1/like', async (route) => {
        await blocked;
        await route.fulfill({ json: { liked: true, likeCount: 8 } });
    });
    await mount(<PublicProfileHarness />);
    await page.getByRole('button', { name: 'Lajkaj vrt', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Makni lajk s vrta' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await page
        .getByRole('radio', { name: 'Cvjetni vrt' })
        .locator('..')
        .click();
    const nextLike = page.getByRole('button', {
        name: 'Lajkaj vrt',
        exact: true,
    });
    await expect(nextLike).toHaveText('8');
    await expect(nextLike).toHaveAttribute('aria-disabled', 'false');
    const response = page.waitForResponse('**/api/gardens/1/like');
    release();
    await response;
    await expect(nextLike).toHaveText('8');
    await expect(nextLike).toHaveAttribute('aria-disabled', 'false');
});

test('keeps the latest selected garden when an earlier request finishes late', async ({
    mount,
    page,
}) => {
    let release = () => {};
    const blocked = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/gardens/2/public', async (route) => {
        await blocked;
        await route.fulfill({ json: gardenDetails[1] });
    });
    await mount(<PublicProfileHarness />);
    const scene = page.getByTestId('garden-scene');
    await expect(scene).toHaveAttribute('data-garden-id', '1');
    await page
        .getByRole('radio', { name: 'Cvjetni vrt' })
        .locator('..')
        .click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Učitavanje vrta...' }),
    ).toBeVisible();
    await expect(scene).toHaveAttribute('data-garden-id', '1');
    await page
        .getByRole('radio', { name: 'Začinsko bilje' })
        .locator('..')
        .click();
    await expect(scene).toHaveAttribute('data-garden-id', '3');
    const previousResponse = page.waitForResponse('**/api/gardens/2/public');
    release();
    await previousResponse;
    await expect(scene).toHaveAttribute('data-garden-id', '3');
});

test('cancels an intermediate transition as soon as a newer garden starts loading', async ({
    mount,
    page,
}) => {
    await page.clock.install();
    let release = () => {};
    const blocked = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/gardens/3/public', async (route) => {
        await blocked;
        await route.fulfill({ json: gardenDetails[2] });
    });
    await mount(<PublicProfileHarness />);
    const scene = page.getByTestId('garden-scene');
    await expect(scene).toHaveAttribute('data-garden-id', '1');
    await page
        .getByRole('radio', { name: 'Cvjetni vrt' })
        .locator('..')
        .click();
    await expect(page.locator('[data-scene-visible]')).toHaveAttribute(
        'data-scene-visible',
        'false',
    );
    await page
        .getByRole('radio', { name: 'Začinsko bilje' })
        .locator('..')
        .click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Učitavanje vrta...' }),
    ).toBeVisible();
    await page.clock.runFor(600);
    await expect(scene).toHaveAttribute('data-garden-id', '1');
    release();
    await expect(scene).toHaveAttribute('data-garden-id', '3');
});

test('recovers from a failed garden request', async ({ mount, page }) => {
    let fail = true;
    await page.route('**/api/gardens/2/public', (route) =>
        fail
            ? route.fulfill({ status: 503, json: { error: 'Unavailable' } })
            : route.fulfill({ json: gardenDetails[1] }),
    );
    await mount(<PublicProfileHarness />);
    await page
        .getByRole('radio', { name: 'Cvjetni vrt' })
        .locator('..')
        .click();
    await expect(page.getByRole('alert')).toContainText(
        'Vrt trenutno nije dostupan.',
    );
    fail = false;
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(page.getByTestId('garden-scene')).toHaveAttribute(
        'data-garden-id',
        '2',
    );
});

test('fits mobile with long garden names and supports reduced motion', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const longName =
        'Moj vrt s povrćem, cvijećem i začinskim biljem za cijelu obitelj';
    await page.route('**/api/users/public/test-profile/profile', (route) =>
        route.fulfill({
            json: {
                ...profile,
                gardens: [{ ...gardens[0], name: longName }, gardens[1]],
            },
        }),
    );
    await mount(<PublicProfileHarness />);
    await expect(page.getByRole('radio', { name: longName })).toBeChecked();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
    await page
        .getByRole('radio', { name: 'Cvjetni vrt' })
        .locator('..')
        .click();
    await expect(page.getByTestId('garden-scene')).toHaveAttribute(
        'data-garden-id',
        '2',
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
        path: '/tmp/gredice-profile-mobile.png',
        fullPage: true,
    });
});

test('shows empty states without requesting an unavailable garden', async ({
    mount,
    page,
}) => {
    const gardenRequests: string[] = [];
    page.on('request', (request) => {
        if (/\/api\/gardens\//.test(request.url()))
            gardenRequests.push(request.url());
    });
    await page.route('**/api/users/public/test-profile/profile', (route) =>
        route.fulfill({ json: { ...profile, gardens: [], achievements: [] } }),
    );
    await mount(<PublicProfileHarness />);
    await expect(page.getByText('Još nema javnih vrtova.')).toBeVisible();
    await expect(
        page.getByText('Još nema otključanih postignuća.'),
    ).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    expect(gardenRequests).toEqual([]);
});
