import { expect, test } from '@playwright/experimental-ct-react';
import { OutletHudStory } from './OutletHudStory';

test('outlet HUD links directly to the 3D garden and keeps the inventory badge', async ({
    mount,
    page,
}) => {
    await mount(<OutletHudStory />);

    const outletLink = page.getByRole('link', {
        name: 'Outlet sadnica',
    });
    const availabilityBadge = outletLink.locator(
        '[data-outlet-availability-badge]',
    );

    await expect(outletLink).toBeVisible();
    await expect(outletLink).toHaveAccessibleName('Outlet sadnica');
    await expect(outletLink).toHaveAttribute('href', '/outlet');
    await expect(availabilityBadge).toHaveText('4');
    await expect(availabilityBadge).toHaveClass(/bg-tertiary/u);
    await expect(availabilityBadge).toHaveClass(/text-tertiary-foreground/u);
    await expect(availabilityBadge).toHaveClass(
        /border-tertiary-foreground\/30/u,
    );
    await expect(
        page.getByRole('dialog', { name: 'Outlet sadnica' }),
    ).toHaveCount(0);
});

test('outlet HUD stays hidden when the 3D garden flag is disabled', async ({
    mount,
    page,
}) => {
    await mount(<OutletHudStory enableOutletGardenFlag={false} />);

    await expect(
        page.getByRole('link', { name: 'Outlet sadnica' }),
    ).toHaveCount(0);
});
