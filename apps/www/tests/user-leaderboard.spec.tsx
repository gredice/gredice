import AxeBuilder from '@axe-core/playwright';
import { UserAchievementProgress } from '@gredice/ui/UserAvatar';
import { expect, test } from '@playwright/experimental-ct-react';
import UsersError from '../app/korisnici/error';
import UsersLoading from '../app/korisnici/loading';
import { UserLeaderboard } from '../app/korisnici/UserLeaderboard';

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
    await mount(<UserAchievementProgress achievementCount={34} />);
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
