import { expect, test } from '@playwright/experimental-ct-react';
import { FarmNotificationListHarness } from '../../playwright/FarmNotificationListHarness';

test('filters unread and all notifications, then toggles read state', async ({
    mount,
    page,
}) => {
    await mount(<FarmNotificationListHarness />);

    await expect(page.getByText('Nova radnja')).toBeVisible();
    await expect(page.getByText('Stara obavijest')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Sve' }).click();
    await expect(page.getByText('Stara obavijest')).toBeVisible();

    await page
        .getByRole('button', {
            name: 'Označi obavijest "Nova radnja" kao pročitanu',
        })
        .click();
    await page.getByRole('tab', { name: 'Nepročitane' }).click();
    await expect(page.getByText('Nova radnja')).toHaveCount(0);
});

test('marks all visible unread notifications as read', async ({
    mount,
    page,
}) => {
    await mount(<FarmNotificationListHarness />);

    await page
        .getByRole('button', { name: 'Označi sve kao pročitane' })
        .click();

    await expect(page.getByText('Nema nepročitanih obavijesti.')).toBeVisible();
    await page.getByRole('tab', { name: 'Sve' }).click();
    await expect(page.getByText('Nova radnja')).toBeVisible();
});

test('opens Farm raised-bed targets and safely ignores unsupported garden links', async ({
    mount,
    page,
}) => {
    await mount(<FarmNotificationListHarness />);

    await page.getByTestId('farm-notification-notification-raised-bed').click();
    await expect(page.getByTestId('opened-target')).toHaveText(
        '/raised-beds/42',
    );
    await expect(page.getByText('Gredica za pregled')).toHaveCount(0);

    await page
        .getByTestId('farm-notification-notification-unsupported')
        .click();
    await expect(page.getByTestId('opened-target')).toHaveText('none');
});
