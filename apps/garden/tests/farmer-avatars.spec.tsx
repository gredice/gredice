import { Avatar } from '@gredice/ui/Avatar';
import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import { Modal } from '@gredice/ui/Modal';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { expect, test } from '@playwright/experimental-ct-react';
import { AvatarCollectionFixture } from './AvatarCollectionFixture';

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

    for (const name of [
        'Farmer',
        'Farmerka',
        'Vrtni robot',
        'Leptir',
        'Vrtni patuljak',
        'Prazno',
    ]) {
        await page.getByRole('button', { name: 'Promijeni avatar' }).click();
        await page
            .getByRole('dialog', { name: 'Odaberi avatar' })
            .getByRole('button', { name, exact: true })
            .click();
    }
    await expect
        .poll(() => selections)
        .toEqual([
            maleUrl,
            femaleUrl,
            'https://cdn.gredice.com/avatars/garden-robot.webp',
            'https://cdn.gredice.com/avatars/butterfly.webp',
            'https://cdn.gredice.com/avatars/garden-gnome.webp',
            null,
        ]);
});

test('every avatar renders from bundled artwork without depending on the CDN', async ({
    mount,
    page,
}) => {
    await page.route('https://cdn.gredice.com/avatars/**', (route) =>
        route.abort(),
    );
    await mount(<AvatarCollectionFixture />);
    await expect(page.getByRole('img')).toHaveCount(58);
    await expect
        .poll(() =>
            page
                .locator('img')
                .evaluateAll((images: HTMLImageElement[]) =>
                    images.every(
                        (image) =>
                            image.complete &&
                            image.naturalWidth === 512 &&
                            !image.src.startsWith('https://cdn.gredice.com/'),
                    ),
                ),
        )
        .toBe(true);
    await expect(page.getByRole('img', { name: /Suncokret/i })).toHaveCount(0);
});

test('the gallery shows the saved selection and restores keyboard focus on dismissal', async ({
    mount,
    page,
}) => {
    const robotUrl = 'https://cdn.gredice.com/avatars/garden-robot.webp';
    await mount(
        <AvatarSelectionMenu
            displayName="Ana"
            avatarUrl={robotUrl}
            onChange={() => {}}
        >
            <button type="button">Promijeni avatar</button>
        </AvatarSelectionMenu>,
    );
    const trigger = page.getByRole('button', { name: 'Promijeni avatar' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Odaberi avatar' });
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Vrtni robot', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
        dialog.getByRole('button', { name: 'Farmer', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(dialog.getByRole('region')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
});

test('a mobile user can reach the last avatar from inside the profile modal', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const selections: (string | null)[] = [];
    await mount(
        <Modal title="Profil" open>
            <AvatarSelectionMenu
                displayName="Ana"
                avatarUrl={null}
                onChange={(value) => selections.push(value)}
            >
                <button type="button">Promijeni avatar</button>
            </AvatarSelectionMenu>
        </Modal>,
    );
    const trigger = page.getByRole('button', { name: 'Promijeni avatar' });
    await trigger.click();
    const picker = page.getByRole('dialog', { name: 'Odaberi avatar' });
    const lastChoice = picker.getByRole('button', {
        name: 'Vrtni patuljak',
        exact: true,
    });
    await lastChoice.scrollIntoViewIfNeeded();
    await expect(lastChoice).toBeInViewport();
    await expect
        .poll(() =>
            picker.evaluate(
                (element) => element.scrollWidth <= element.clientWidth,
            ),
        )
        .toBe(true);
    await lastChoice.click();
    await expect
        .poll(() => selections)
        .toEqual(['https://cdn.gredice.com/avatars/garden-gnome.webp']);
    await expect(picker).not.toBeVisible();
    await expect(
        page.getByRole('dialog', { name: 'Profil', exact: true }),
    ).toBeVisible();
    await expect(trigger).toBeFocused();
});
