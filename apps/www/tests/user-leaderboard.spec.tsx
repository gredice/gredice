import AxeBuilder from '@axe-core/playwright';
import { getAchievementDefinitions } from '@gredice/js/achievements';
import { UserAchievementProgress } from '@gredice/ui/UserAvatar';
import UsersLoading from '../app/korisnici/(ljestvica)/loading';
import UsersError from '../app/korisnici/error';
import { UserLeaderboard } from '../app/korisnici/UserLeaderboard';
import { expect, test } from './component-fixtures';

const items = Array.from({ length: 10 }, (_, index) => ({
    id: `user-${index}`,
    publicId: `u_${index}`,
    displayName: [
        'Ana Kovač',
        'Marko Marić',
        'Petra Horvat',
        'Luka Babić',
        'Iva Novak',
        'Ivan Jurić',
        'Maja Perić',
        'Tomislav Radić',
        'Nina Vidović',
        'Veseli vrtlar',
    ][index],
    avatarUrl: null,
    achievementCount: 34 - index * 3,
    createdAt: '2026-01-01T00:00:00.000Z',
}));

test('completing every available achievement celebrates completion', async ({
    mount,
    page,
}) => {
    await mount(
        <UserAchievementProgress
            achievementCount={getAchievementDefinitions().length}
        />,
    );
    await expect(page.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '100',
    );
    await expect(page.getByText('Sva postignuća osvojena!')).toBeVisible();
    await expect(page.getByText(/do razine 9/)).toHaveCount(0);
});

for (const width of [390, 1280]) {
    test(`leaderboard shows ten linked profiles, readable levels and no overflow at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await mount(
            <main className="px-4">
                <UserLeaderboard items={items} />
            </main>,
        );
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'Vrtlari koji rastu zajedno',
        );
        await expect(
            page.getByRole('link', {
                name: 'Kako skupljati XP i prijeći na novu razinu',
            }),
        ).toHaveAttribute('href', '/iskustvo-i-razine');
        const cta = page.getByRole('region', {
            name: 'Pridruži se vrtlarima.',
        });
        await expect(cta).toBeVisible();
        await expect(
            cta.getByRole('link', { name: 'Istraži postignuća' }),
        ).toHaveAttribute('href', '/postignuca');
        const rows = page.locator('ol > li');
        await expect(rows).toHaveCount(10);
        await expect(rows.first().getByRole('link')).toHaveAttribute(
            'href',
            '/korisnici/u_0',
        );
        await expect(
            rows.first().getByRole('img', { name: 'Razina 8' }),
        ).toBeVisible();
        await expect(rows.first()).toContainText('3.400 XP');
        // Gold, silver and bronze mark the podium; later places stay plain.
        const placeColors = await rows
            .locator('a > span:first-child')
            .evaluateAll((places) =>
                places.map((place) => getComputedStyle(place).backgroundColor),
            );
        expect(new Set(placeColors.slice(0, 3)).size).toBe(3);
        expect(placeColors.slice(0, 3)).not.toContain('rgba(0, 0, 0, 0)');
        expect(new Set(placeColors.slice(3))).toEqual(
            new Set(['rgba(0, 0, 0, 0)']),
        );
        await page.keyboard.press('Tab');
        await expect(rows.first().getByRole('link')).toBeFocused();
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
        await page.screenshot({
            path: `/tmp/gredice-user-leaderboard-${width}.png`,
            fullPage: true,
        });
    });
}

test('shows how many gardeners are outside the top ten with an avatar stack', async ({
    mount,
    page,
}) => {
    const communityAvatarUrls = [
        'https://cdn.gredice.com/avatars/bearded-farmer.webp',
        'https://cdn.gredice.com/avatars/garden-cat.webp',
        'https://cdn.gredice.com/avatars/hedgehog.webp',
        'https://cdn.gredice.com/avatars/botanist.webp',
        'https://cdn.gredice.com/avatars/rabbit.webp',
    ];
    const component = await mount(
        <main className="px-4">
            <UserLeaderboard
                items={items}
                userCount={1250}
                communityAvatarUrls={communityAvatarUrls}
            />
        </main>,
    );
    const others = page.getByText('i još 1.240 vrtlara');
    await expect(others).toBeVisible();
    const stack = page.locator('[aria-hidden="true"]:has(img)');
    await expect(stack.locator('img')).toHaveCount(5);
    expect(
        await stack
            .locator('img')
            .evaluateAll((images) =>
                images.every(
                    (image) =>
                        image instanceof HTMLImageElement &&
                        image.naturalWidth > 0,
                ),
            ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Never more avatars than hidden gardeners, with the singular noun.
    await component.update(
        <main className="px-4">
            <UserLeaderboard
                items={items}
                userCount={11}
                communityAvatarUrls={communityAvatarUrls}
            />
        </main>,
    );
    await expect(
        page.getByText('i još 1 vrtlar', { exact: true }),
    ).toBeVisible();
    await expect(stack.locator('img')).toHaveCount(1);

    // Everyone is listed, or an older API omits the count: no row.
    for (const userCount of [10, undefined]) {
        await component.update(
            <main className="px-4">
                <UserLeaderboard
                    items={items}
                    userCount={userCount}
                    communityAvatarUrls={communityAvatarUrls}
                />
            </main>,
        );
        await expect(page.getByText(/i još/)).toHaveCount(0);
    }
});

test('supports short lists and long names on narrow screens', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await mount(
        <main className="px-4">
            <UserLeaderboard
                items={[
                    {
                        ...items[0],
                        displayName:
                            'VrloDugačkoKorisničkoImeBezRazmakaKojeMoraStatiNaEkran',
                    },
                ]}
            />
        </main>,
    );
    await expect(page.locator('ol > li')).toHaveCount(1);
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
});

test('empty, loading and error states do not invent rankings and allow retry', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <main>
            <UserLeaderboard items={[]} />
        </main>,
    );
    await expect(page.getByText(/Ljestvica čeka prva/)).toBeVisible();
    await expect(page.locator('ol')).toHaveCount(0);
    await component.update(
        <main>
            <UsersLoading />
        </main>,
    );
    await expect(page.getByRole('status')).toHaveText(
        'Učitavanje korisnika...',
    );
    let retried = false;
    await component.update(
        <main>
            <UsersError
                reset={() => {
                    retried = true;
                }}
            />
        </main>,
    );
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect.poll(() => retried).toBe(true);
});
