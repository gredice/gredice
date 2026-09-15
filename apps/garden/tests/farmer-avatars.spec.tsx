import { Avatar } from '@gredice/ui/Avatar';
import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { expect, test } from '@playwright/experimental-ct-react';

const maleUrl = 'https://cdn.gredice.com/avatars/farmer-male.png';
const femaleUrl = 'https://cdn.gredice.com/avatars/farmer-female.png';

test('renders saved farmer choices as bundled portraits in both avatar components', async ({
    mount,
    page,
}) => {
    await page.route('https://cdn.gredice.com/avatars/**', (route) =>
        route.abort(),
    );
    await mount(
        <div>
            <Avatar src={maleUrl} alt="Farmer" />
            <Avatar src={femaleUrl} alt="Farmerka" />
            <UserAvatar
                avatarUrl={maleUrl}
                displayName="Marko"
                achievementCount={3}
            />
            <UserAvatar avatarUrl={femaleUrl} displayName="Ana" />
        </div>,
    );

    for (const name of ['Farmer', 'Farmerka', 'Marko', 'Ana']) {
        const image = page.getByRole('img', { name, exact: true });
        await expect(image).not.toHaveAttribute('src', /^https:\/\/cdn/);
        await expect
            .poll(() =>
                image.evaluate(
                    (element: HTMLImageElement) =>
                        element.complete && element.naturalWidth > 0,
                ),
            )
            .toBe(true);
    }
    await expect(page.getByLabel('Razina 3', { exact: true })).toBeVisible();
});

test('preserves custom URLs and initials', async ({ mount, page }) => {
    const customUrl =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect width="48" height="48" fill="green"/%3E%3C/svg%3E';
    await mount(
        <div>
            <Avatar src={customUrl} alt="Custom primitive" />
            <UserAvatar avatarUrl={customUrl} displayName="Custom user" />
            <UserAvatar avatarUrl={null} displayName="Ana Kovač" />
        </div>,
    );
    for (const name of ['Custom primitive', 'Custom user']) {
        await expect(page.getByRole('img', { name })).toHaveAttribute(
            'src',
            customUrl,
        );
    }
    await expect(page.getByText('AK', { exact: true })).toBeVisible();
});

test('the avatar picker keeps saving stable choices and can clear the selection', async ({
    mount,
    page,
}) => {
    const selections: (string | null)[] = [];
    await mount(
        <AvatarSelectionMenu
            displayName="Ana Kovač"
            onChange={(value) => selections.push(value)}
        >
            <button type="button">Promijeni avatar</button>
        </AvatarSelectionMenu>,
    );

    for (const name of ['Farmer', 'Farmerka', 'Prazno']) {
        await page.getByRole('button', { name: 'Promijeni avatar' }).click();
        await page.getByRole('menuitem', { name, exact: true }).click();
    }
    await expect.poll(() => selections).toEqual([maleUrl, femaleUrl, null]);
});
