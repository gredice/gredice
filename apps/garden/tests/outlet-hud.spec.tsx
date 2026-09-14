import { expect, test } from '@playwright/experimental-ct-react';
import { OutletHudStory } from './OutletHudStory';

test('keeps the Outlet control hidden while offers are loading', async ({
    mount,
    page,
}) => {
    await mount(<OutletHudStory loading />);

    await expect(
        page.getByRole('link', { name: 'Outlet sadnica' }),
    ).toHaveCount(0);
    await expect(page.locator('[data-outlet-hud-shell="true"]')).toHaveCount(0);
});

test('does not request or poll for Outlet offers while the HUD is disabled', async ({
    mount,
    page,
}) => {
    let outletRequests = 0;
    await page.route('**/api/gredice/api/outlet/offers**', async (route) => {
        outletRequests += 1;
        await route.fulfill({ json: { items: [] }, status: 200 });
    });

    await mount(<OutletHudStory enabled={false} />);
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                );
            }),
    );

    expect(outletRequests).toBe(0);
    await expect(
        page.getByRole('link', { name: 'Outlet sadnica' }),
    ).toHaveCount(0);
});

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
    const outletHudShell = page.locator('[data-outlet-hud-shell]');

    await expect(outletLink).toBeVisible();
    await expect(outletHudShell).toHaveCSS('width', '48px');
    await expect(outletHudShell).toHaveCSS('height', '48px');
    await expect(outletHudShell).toHaveClass(/rounded-full/u);
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
