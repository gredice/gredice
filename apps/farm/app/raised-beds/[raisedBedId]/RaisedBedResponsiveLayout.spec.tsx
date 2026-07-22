import { expect, test } from '@playwright/experimental-ct-react';
import '../../globals.css';
import { RaisedBedResponsiveLayoutHarness } from './RaisedBedResponsiveLayoutHarness';

test('unmounts portalled status menus when crossing the desktop breakpoint', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mount(<RaisedBedResponsiveLayoutHarness />);

    await page.getByRole('button', { name: 'Otvori mobile status' }).click();
    await expect(page.getByText('mobile status opcije')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Otvori desktop status' }),
    ).toHaveCount(0);

    await page.setViewportSize({ width: 1024, height: 768 });

    await expect(page.getByText('mobile status opcije')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Otvori mobile status' }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Otvori desktop status' }).click();
    await expect(page.getByText('desktop status opcije')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.getByText('desktop status opcije')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Otvori desktop status' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Otvori mobile status' }),
    ).toBeVisible();
});
