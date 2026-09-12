import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { PublicProfileHarness } from './PublicProfileHarness';

const gardens = [
    { id: 1, name: 'Povrtnjak', createdAt: '2026-01-01' },
    { id: 2, name: 'Cvjetni vrt', createdAt: '2026-01-01' },
    { id: 3, name: 'Začinsko bilje', createdAt: '2026-01-01' },
];
const profile = {
    user: { displayName: 'Veseli vrtlar', userName: 'private@example.com' },
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
    await page.route('**/api/users/public/test-profile/profile', (route) =>
        route.fulfill({ json: profile }),
    );
    await page.route('**/api/gardens/*/public', (route) => {
        const id = Number(route.request().url().split('/').at(-2));
        return route.fulfill({
            json: gardens.find((garden) => garden.id === id),
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
        await route.fulfill({ json: gardens[1] });
    });
    await mount(<PublicProfileHarness />);
    const scene = page.getByTestId('garden-scene');
    await expect(scene).toHaveAttribute('data-garden-id', '1');
    await page.getByText('Cvjetni vrt', { exact: true }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Učitavanje vrta...' }),
    ).toBeVisible();
    await expect(scene).toHaveAttribute('data-garden-id', '1');
    await page.getByText('Začinsko bilje', { exact: true }).click();
    await expect(scene).toHaveAttribute('data-garden-id', '3');
    const previousResponse = page.waitForResponse('**/api/gardens/2/public');
    release();
    await previousResponse;
    await expect(scene).toHaveAttribute('data-garden-id', '3');
});

test('recovers from a failed garden request', async ({ mount, page }) => {
    let fail = true;
    await page.route('**/api/gardens/2/public', (route) =>
        fail
            ? route.fulfill({ status: 503, json: { error: 'Unavailable' } })
            : route.fulfill({ json: gardens[1] }),
    );
    await mount(<PublicProfileHarness />);
    await page.getByText('Cvjetni vrt', { exact: true }).click();
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
    await page.getByText('Cvjetni vrt', { exact: true }).click();
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
