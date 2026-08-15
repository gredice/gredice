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
    const outletIcon = outletLink.locator('[data-outlet-trigger-icon]');

    await expect(outletLink).toBeVisible();
    await expect(outletLink).toHaveAccessibleName('Outlet sadnica');
    await expect(outletLink).toHaveAttribute('href', '/outlet');
    await expect(outletIcon).toHaveAttribute(
        'src',
        '/assets/hud/outlet-seedling-price-tag.webp',
    );
    await expect(outletIcon).toHaveClass(/-translate-y-2\.5/u);
    await expect(availabilityBadge).toHaveText('4');
    await expect(availabilityBadge).toHaveClass(/pointer-events-none/u);
    await expect(availabilityBadge).toHaveClass(/bg-tertiary/u);
    await expect(availabilityBadge).toHaveClass(/text-tertiary-foreground/u);
    await expect(availabilityBadge).toHaveClass(
        /border-tertiary-foreground\/30/u,
    );
    await expect(
        page.getByRole('dialog', { name: 'Outlet sadnica' }),
    ).toHaveCount(0);
});
