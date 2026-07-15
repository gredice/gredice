import { expect, test } from '@playwright/experimental-ct-react';
import { OutletHudStory } from './OutletHudStory';

test('outlet HUD matches the inventory badge colors', async ({
    mount,
    page,
}) => {
    await mount(<OutletHudStory searchParams="vrt=1" />);

    const outletButton = page.getByRole('button', {
        name: 'Outlet sadnica',
    });
    const availabilityBadge = outletButton.locator(
        '[data-outlet-availability-badge]',
    );

    await expect(outletButton).toBeVisible();
    await expect(outletButton).toHaveAccessibleName('Outlet sadnica');
    await expect(availabilityBadge).toHaveText('4');
    await expect(availabilityBadge).toHaveClass(/bg-tertiary/u);
    await expect(availabilityBadge).toHaveClass(/text-tertiary-foreground/u);
    await expect(availabilityBadge).toHaveClass(
        /border-tertiary-foreground\/30/u,
    );
    await expect(outletButton.getByText('Outlet', { exact: true })).toHaveCount(
        0,
    );
});

test('outlet modal collapses offers and lets user pick a not-yet-active raised bed', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 900, height: 720 });
    await mount(<OutletHudStory searchParams="vrt=1&outlet=1" />);

    const dialog = page.getByRole('dialog', { name: 'Outlet sadnica' });
    await expect(dialog.locator('[data-outlet-offer-list]')).toBeVisible();
    await expect(dialog.locator('[data-outlet-raised-bed-picker]')).toHaveCount(
        0,
    );

    await dialog
        .getByRole('button', { name: /Paprika Zlata Snack Paprika/ })
        .click();

    await expect(dialog.locator('[data-outlet-offer-list]')).toHaveCount(0);
    await expect(dialog.locator('[data-outlet-selected-offer]')).toContainText(
        'Paprika Zlata Snack Paprika',
    );

    const raisedBedOptions = dialog.locator('[data-outlet-raised-bed-option]');
    await expect(raisedBedOptions).toHaveCount(2);
    await expect(raisedBedOptions.nth(0)).toContainText('Aktivna gredica');
    await expect(raisedBedOptions.nth(0)).toContainText('Prvo prazno polje 2');
    await expect(raisedBedOptions.nth(1)).toContainText('Nova gredica');
    await expect(raisedBedOptions.nth(1)).toContainText('Prvo prazno polje 1');

    await raisedBedOptions.nth(1).click();
    await expect(raisedBedOptions.nth(1)).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    await expect(
        dialog.getByRole('button', { name: 'Nastavi na sijanje' }),
    ).toBeEnabled();
});

test('selected outlet offer starts collapsed from the URL', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 900, height: 720 });
    await mount(<OutletHudStory searchParams="vrt=1&outlet=302" />);

    const dialog = page.getByRole('dialog', { name: 'Outlet sadnica' });
    await expect(dialog.locator('[data-outlet-offer-list]')).toHaveCount(0);
    await expect(dialog.locator('[data-outlet-selected-offer]')).toContainText(
        'Paprika Zlata Snack Paprika',
    );
    await expect(dialog.locator('[data-outlet-raised-bed-option]')).toHaveCount(
        2,
    );
});
