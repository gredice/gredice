import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { FarmProfileSettings } from './FarmProfileSettings';

const farmerAvatar = 'https://cdn.gredice.com/avatars/farmer-male.png';

for (const width of [390, 768, 1280]) {
    test(`edits a farmer profile at ${width}px`, async ({ mount, page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        let submittedBody = '';
        await page.route('**/test/farm-profile', async (route) => {
            submittedBody = route.request().postData() ?? '';
            await route.fulfill({
                json: {
                    success: true,
                    displayName: 'Ana Horvat',
                    avatarUrl: farmerAvatar,
                    message: 'Profil je spremljen.',
                },
            });
        });
        await mount(
            <main className="mx-auto max-w-5xl p-4">
                <h1>Postavke</h1>
                <FarmProfileSettings displayName="Ana" avatarUrl={null} />
            </main>,
        );

        const saveButton = page.getByRole('button', { name: 'Spremi profil' });
        await expect(saveButton).toBeDisabled();
        await page.getByLabel('Ime za prikaz').fill('Ana Horvat');
        await page.getByRole('button', { name: 'Promijeni avatar' }).click();
        await page.getByRole('button', { name: 'Farmer', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(
            page.getByRole('img', { name: 'Ana Horvat' }),
        ).toBeVisible();
        await saveButton.click();

        await expect(page.getByRole('status')).toHaveText(
            'Profil je spremljen.',
        );
        await expect(saveButton).toBeDisabled();
        expect(submittedBody).toContain('Ana Horvat');
        expect(submittedBody).toContain(farmerAvatar);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
        await page.screenshot({
            path: test.info().outputPath(`farm-profile-${width}.png`),
        });
    });
}

test('preserves an existing custom avatar when editing only the name', async ({
    mount,
    page,
}) => {
    const customAvatar = 'https://example.com/existing-avatar.png';
    let submittedBody = '';
    await page.route('**/test/farm-profile', async (route) => {
        submittedBody = route.request().postData() ?? '';
        await route.fulfill({
            json: {
                success: true,
                displayName: 'Novo ime',
                avatarUrl: customAvatar,
                message: 'Profil je spremljen.',
            },
        });
    });
    await mount(
        <FarmProfileSettings displayName="Ana" avatarUrl={customAvatar} />,
    );
    await page.getByLabel('Ime za prikaz').fill('Novo ime');
    await page.getByRole('button', { name: 'Spremi profil' }).click();
    await expect(page.getByRole('status')).toHaveText('Profil je spremljen.');
    expect(submittedBody).toContain(customAvatar);
});

test('removes an avatar, retains edits after a failed save, and retries', async ({
    mount,
    page,
}) => {
    let attempts = 0;
    await page.route('**/test/farm-profile', async (route) => {
        attempts += 1;
        expect(route.request().postData()).not.toContain(farmerAvatar);
        await route.fulfill({
            json:
                attempts === 1
                    ? {
                          success: false,
                          message: 'Profil nije spremljen. Pokušaj ponovno.',
                      }
                    : {
                          success: true,
                          displayName: 'Ana Horvat',
                          avatarUrl: null,
                          message: 'Profil je spremljen.',
                      },
        });
    });
    await mount(
        <FarmProfileSettings displayName="Ana" avatarUrl={farmerAvatar} />,
    );
    await page.getByLabel('Ime za prikaz').fill('Ana Horvat');
    await page.getByRole('button', { name: 'Promijeni avatar' }).click();
    await page.getByRole('button', { name: 'Prazno' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('AH', { exact: true })).toBeVisible();
    const saveButton = page.getByRole('button', { name: 'Spremi profil' });
    await saveButton.click();
    await expect(page.getByRole('alert')).toHaveText(
        'Profil nije spremljen. Pokušaj ponovno.',
    );
    await expect(page.getByLabel('Ime za prikaz')).toHaveValue('Ana Horvat');
    await expect(saveButton).toBeEnabled();
    await page.getByLabel('Ime za prikaz').fill('Ana Horvat ');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await saveButton.click();
    await expect(page.getByRole('status')).toHaveText('Profil je spremljen.');
    await expect(saveButton).toBeDisabled();
    expect(attempts).toBe(2);
});

test('rejects blank names and disables editing while a save is pending', async ({
    mount,
    page,
}) => {
    let finishSave: (() => void) | undefined;
    const pendingSave = new Promise<void>((resolve) => {
        finishSave = resolve;
    });
    await page.route('**/test/farm-profile', async (route) => {
        await pendingSave;
        await route.fulfill({
            json: {
                success: true,
                displayName: 'Ana Horvat',
                avatarUrl: null,
                message: 'Profil je spremljen.',
            },
        });
    });
    await mount(<FarmProfileSettings displayName="Ana" avatarUrl={null} />);
    const nameInput = page.getByLabel('Ime za prikaz');
    const saveButton = page.getByRole('button', { name: 'Spremi profil' });
    await nameInput.fill('   ');
    await expect(saveButton).toBeDisabled();
    await nameInput.fill('Ana Horvat');
    await saveButton.click();
    await expect(nameInput).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Promijeni avatar' }),
    ).toBeDisabled();
    await expect(saveButton).toBeDisabled();
    finishSave?.();
    await expect(page.getByRole('status')).toHaveText('Profil je spremljen.');
});

test('keeps the draft available when the connection fails', async ({
    mount,
    page,
}) => {
    await page.route('**/test/farm-profile', (route) => route.abort());
    await mount(<FarmProfileSettings displayName="Ana" avatarUrl={null} />);
    await page.getByLabel('Ime za prikaz').fill('Ana Horvat');
    const saveButton = page.getByRole('button', { name: 'Spremi profil' });
    await saveButton.click();
    await expect(page.getByRole('alert')).toHaveText(
        'Profil nije spremljen. Pokušaj ponovno.',
    );
    await expect(page.getByLabel('Ime za prikaz')).toHaveValue('Ana Horvat');
    await expect(saveButton).toBeEnabled();
});
