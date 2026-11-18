import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './component-fixtures';
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
function achievement(key: string, status: 'approved' | 'pending', id: number) {
    return {
        id,
        key,
        status,
        rewardSunflowers: 100,
        progressValue: null,
        threshold: null,
        rewardGrantedAt: null,
        createdAt: '2026-03-12T08:00:00.000Z',
        updatedAt: '2026-03-12T08:00:00.000Z',
    };
}
const profile = {
    user: {
        id: 'test-user-id',
        publicId: 'test-profile',
        displayName: 'Veseli vrtlar',
        userName: 'private@example.com',
        avatarUrl: null,
        achievementCount: 6,
        createdAt: '2026-03-12T08:00:00.000Z',
    },
    gardens,
    achievements: [
        achievement('registration', 'approved', 1),
        achievement('planting_1', 'approved', 2),
        achievement('planting_20', 'approved', 3),
        achievement('watering_20', 'approved', 4),
        achievement('watering_1', 'approved', 5),
        achievement('harvest_20', 'approved', 6),
        achievement('harvest_50', 'pending', 7),
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
    await page.route('**/api/gardens/*/public', (route) => {
        const id = Number(route.request().url().split('/').at(-2));
        return route.fulfill({
            json: gardenDetails.find((garden) => garden.id === id),
        });
    });
});

test('shows custom award milestones and visible gardens without exposing the login name', async ({
    mount,
    page,
}) => {
    await mount(<PublicProfileHarness profile={profile} />);
    await expect(
        page.getByRole('link', { name: 'Kako funkcioniraju XP i razine?' }),
    ).toHaveAttribute('href', '/iskustvo-i-razine');
    await expect(
        page.getByRole('heading', { name: 'Veseli vrtlar' }),
    ).toBeVisible();
    await expect(page.getByText('private@example.com')).toHaveCount(0);
    await expect(
        page
            .getByRole('navigation', { name: 'Breadcrumb' })
            .getByRole('link', { name: 'Vrtlari' }),
    ).toHaveAttribute('href', '/korisnici');
    const header = page.locator('header');
    await expect(header.getByText('Razina 4 · 600 XP')).toBeVisible();
    for (const [label, value] of [
        ['Postignuća', '6'],
        ['Zbirke', '4 / 8'],
        ['Javni vrtovi', '3'],
    ]) {
        await expect(
            header.getByRole('listitem').filter({ hasText: label }),
        ).toContainText(value);
    }
    await expect(page.getByText('VV', { exact: true })).toBeVisible();
    await expect(page.getByText('Korisnik već 6 mjeseci')).toBeVisible();
    await expect(page.getByText(/vrtova|bez HUD-a/)).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(3);
    const achievements = page.getByRole('region', { name: 'Postignuća' });
    await expect(achievements.getByRole('listitem')).toHaveCount(4);
    await expect(achievements.locator('[data-achievement-key]')).toHaveCount(4);
    await expect(
        achievements.locator('[data-achievement-key="planting_20"]'),
    ).toBeVisible();
    await expect(
        achievements.locator('[data-achievement-key="harvest_50"]'),
    ).toHaveCount(0);
    await expect(achievements.getByText('Razina III / IX')).toHaveCount(2);
    await expect(achievements.getByText('Razina III / XIII')).toHaveCount(1);
    expect(
        await achievements.locator('svg image').evaluateAll(async (images) =>
            Promise.all(
                images.map(async (element) => {
                    const image = new Image();
                    image.src = element.getAttribute('href') ?? '';
                    await image.decode();
                    return image.naturalWidth;
                }),
            ),
        ),
    ).toEqual([512, 512, 512, 512]);
    await expect(
        achievements.getByRole('heading', { name: '20 biljaka' }),
    ).toBeVisible();
    await expect(achievements.getByText('Prvo sjeme')).toHaveCount(0);
    await expect(achievements.getByText('50 berbi')).toHaveCount(0);
    await expect(
        achievements.getByRole('link', { name: '20 biljaka' }),
    ).toHaveAttribute('href', '/postignuca#planting_20');
    await expect(
        achievements.getByRole('listitem').filter({ hasText: '20 biljaka' }),
    ).toContainText('Sadnja');
    // Awards sit in one row of equal cards on desktop.
    const badges = await achievements.getByRole('listitem').all();
    const firstBadge = await badges[0].boundingBox();
    const secondBadge = await badges[1].boundingBox();
    if (!firstBadge || !secondBadge)
        throw new Error('Expected achievement layout');
    expect(secondBadge.y).toBe(firstBadge.y);
    expect(secondBadge.height).toBe(firstBadge.height);
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
        details.getByRole('link', { name: 'Posjeti vrt' }),
    ).toHaveAttribute('href', '/vrtovi/1');
    await expect(
        details.getByRole('button', { name: 'Prijavi se za lajk' }),
    ).toHaveText('7');
    await details.getByRole('button', { name: /Statistika vrta/ }).click();
    await expect(details.getByText('1 m²')).toBeVisible();
    await expect(
        details
            .getByText('Cijena blokova')
            .locator('..')
            .getByText(/^2\s*Suncokreti$/u),
    ).toBeVisible();
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
    await mount(<PublicProfileHarness profile={profile} />);
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
    await mount(
        <PublicProfileHarness
            profile={{
                ...profile,
                user: { ...profile.user, avatarUrl: '/test-avatar.svg' },
            }}
        />,
    );
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
    await mount(<PublicProfileHarness profile={profile} />);
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
    await mount(<PublicProfileHarness profile={profile} />);
    await page
        .getByRole('button', { name: 'Lajkaj vrt, 7', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Makni lajk s vrta' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await page
        .getByRole('radio', { name: 'Cvjetni vrt' })
        .locator('..')
        .click();
    const nextLike = page.getByRole('button', {
        name: 'Lajkaj vrt, 8',
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
    await mount(<PublicProfileHarness profile={profile} />);
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
    await mount(<PublicProfileHarness profile={profile} />);
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
    await mount(<PublicProfileHarness profile={profile} />);
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
    await mount(
        <PublicProfileHarness
            profile={{
                ...profile,
                gardens: [{ ...gardens[0], name: longName }, gardens[1]],
            }}
        />,
    );
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

test('names a single garden without offering a choice', async ({
    mount,
    page,
}) => {
    await mount(
        <PublicProfileHarness
            profile={{ ...profile, gardens: [gardens[1]] }}
        />,
    );
    const details = page.getByRole('region', { name: 'Vrt: Cvjetni vrt' });
    await expect(
        details.getByRole('heading', { name: 'Cvjetni vrt' }),
    ).toBeVisible();
    await expect(
        details.getByRole('link', { name: 'Posjeti vrt' }),
    ).toHaveAttribute('href', '/vrtovi/2');
    await expect(page.getByRole('radio')).toHaveCount(0);
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
    await mount(
        <PublicProfileHarness
            profile={{ ...profile, gardens: [], achievements: [] }}
        />,
    );
    await expect(page.getByText('Još nema javnih vrtova.')).toBeVisible();
    await expect(
        page.getByText('Još nema otključanih postignuća.'),
    ).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    const header = page.locator('header');
    await expect(
        header.getByRole('listitem').filter({ hasText: 'Zbirke' }),
    ).toContainText('0 / 8');
    await expect(
        header.getByRole('listitem').filter({ hasText: 'Javni vrtovi' }),
    ).toContainText('0');
    expect(gardenRequests).toEqual([]);
});
