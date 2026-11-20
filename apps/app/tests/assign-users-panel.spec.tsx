import { expect, test } from '@playwright/experimental-ct-react';
import { AssignUsersPanelHarness } from '../playwright/AssignUsersPanelHarness';

const users = [
    {
        id: 'aleks',
        userName: 'aleks@example.com',
        displayName: 'Aleks',
        avatarUrl: null,
        achievementCount: 3,
    },
    {
        id: 'vesna',
        userName: 'vesna@example.com',
        displayName: 'Vesna',
        avatarUrl: null,
    },
    {
        id: 'matea',
        userName: 'matea@example.com',
        displayName: null,
        avatarUrl: null,
    },
];

test('toggles users, clears all and saves the selection', async ({ mount }) => {
    const component = await mount(
        <AssignUsersPanelHarness
            users={users}
            initialSelectedUserIds={['vesna']}
        />,
    );

    const aleks = component.getByRole('checkbox', { name: /Aleks/ });
    const vesna = component.getByRole('checkbox', { name: /Vesna/ });
    const matea = component.getByRole('checkbox', {
        name: /matea@example\.com/,
    });

    await expect(component.getByText('aleks@example.com')).toBeVisible();
    await expect(vesna).toBeChecked();
    await expect(aleks).not.toBeChecked();
    await expect(component.getByText('Odabrano: 1 od 3')).toBeVisible();

    await component.getByText('Aleks', { exact: true }).click();
    await matea.press('Space');
    await expect(aleks).toBeChecked();
    await expect(matea).toBeChecked();
    await expect(component.getByText('Odabrano: 3 od 3')).toBeVisible();

    await component.getByRole('button', { name: 'Spremi dodjelu' }).click();
    await expect(component.getByTestId('saved')).toHaveText(
        'vesna,aleks,matea',
    );

    await component.getByRole('button', { name: 'Ukloni sve dodjele' }).click();
    await expect(aleks).not.toBeChecked();
    await expect(vesna).not.toBeChecked();
    await expect(
        component.getByRole('button', { name: 'Ukloni sve dodjele' }),
    ).toBeDisabled();

    await component.getByRole('button', { name: 'Spremi dodjelu' }).click();
    await expect(component.getByTestId('saved')).toHaveText('');
});

test('filters long user lists by name or email', async ({ mount }) => {
    const manyUsers = Array.from({ length: 8 }, (_, index) => ({
        id: `user-${index}`,
        userName: `korisnik${index}@example.com`,
        displayName:
            index === 5
                ? 'Željka'
                : index === 6
                  ? 'Đurđica'
                  : `Korisnik ${index}`,
        avatarUrl: null,
    }));
    const component = await mount(
        <AssignUsersPanelHarness users={manyUsers} />,
    );
    const search = component.getByRole('searchbox', {
        name: 'Pretraži korisnike',
    });

    await search.fill('zeljka');
    await expect(component.getByRole('checkbox')).toHaveCount(1);
    await expect(
        component.getByRole('checkbox', { name: /Željka/ }),
    ).toBeVisible();

    await search.fill('durdica');
    await expect(component.getByRole('checkbox')).toHaveCount(1);
    await expect(
        component.getByRole('checkbox', { name: /Đurđica/ }),
    ).toBeVisible();

    await search.fill('nepostojeci');
    await expect(component.getByRole('checkbox')).toHaveCount(0);
    await expect(
        component.getByText('Nema korisnika za ovu pretragu.'),
    ).toBeVisible();
});

test('shows an empty state when the farm has no users', async ({ mount }) => {
    const component = await mount(<AssignUsersPanelHarness users={[]} />);

    await expect(
        component.getByText(
            'Na ovu farmu još nije dodijeljen nijedan korisnik.',
        ),
    ).toBeVisible();
    await expect(component.getByRole('checkbox')).toHaveCount(0);
});

test('scrolls keyboard-focused rows fully into view in both directions', async ({
    mount,
    page,
}) => {
    // Phone-sized viewport, as in the mobile drawer.
    await page.setViewportSize({ width: 390, height: 520 });
    const manyUsers = Array.from({ length: 6 }, (_, index) => ({
        id: `user-${index}`,
        userName: `korisnik${index}@example.com`,
        displayName: `Korisnik ${index}`,
        avatarUrl: null,
    }));
    const component = await mount(
        <AssignUsersPanelHarness users={manyUsers} />,
    );
    const list = component.locator('fieldset');

    async function expectRowFullyVisible(index: number) {
        await expect(
            component.getByRole('checkbox', {
                name: new RegExp(`Korisnik ${index}`),
            }),
        ).toBeFocused();
        const listBox = await list.boundingBox();
        const rowBox = await component
            .locator('label', { hasText: `Korisnik ${index}` })
            .boundingBox();
        expect(listBox).not.toBeNull();
        expect(rowBox).not.toBeNull();
        if (!listBox || !rowBox) {
            return;
        }
        expect(rowBox.y).toBeGreaterThanOrEqual(listBox.y - 1);
        expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(
            listBox.y + listBox.height + 1,
        );
    }

    await component.getByRole('checkbox', { name: /Korisnik 0/ }).focus();
    await expectRowFullyVisible(0);
    for (let index = 1; index < manyUsers.length; index++) {
        await page.keyboard.press('Tab');
        await expectRowFullyVisible(index);
    }
    for (let index = manyUsers.length - 2; index >= 0; index--) {
        await page.keyboard.press('Shift+Tab');
        await expectRowFullyVisible(index);
    }
});
