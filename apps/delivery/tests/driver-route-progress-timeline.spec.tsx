import { expect, test } from '@playwright/experimental-ct-react';
import { DriverRouteProgressTimelineStory } from './DriverRouteProgressTimelineStory';
import '../app/globals.css';

test('keeps the maximum 27-node route compact and horizontally contained', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await mount(<DriverRouteProgressTimelineStory />);

    const timeline = page.getByRole('list', {
        name: 'Tijek dostavne rute',
    });
    const rows = timeline.getByRole('listitem');
    await expect(rows).toHaveCount(27);
    await expect(page.getByTestId('route-details')).toHaveCount(0);

    const firstRow = await rows.first().boundingBox();
    expect(firstRow).not.toBeNull();
    expect(firstRow?.height ?? Number.MAX_VALUE).toBeLessThanOrEqual(160);
    expect(
        await timeline.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        ),
    ).toBe(true);
});

test('distinguishes route states with text and semantic current-step state', async ({
    mount,
    page,
}) => {
    await mount(<DriverRouteProgressTimelineStory />);

    const timeline = page.getByRole('list', {
        name: 'Tijek dostavne rute',
    });
    await expect(timeline.getByText('Dovršeno', { exact: true })).toHaveCount(
        2,
    );
    await expect(
        timeline.getByText('Trenutačna stanica', { exact: true }),
    ).toBeVisible();
    await expect(
        timeline.getByText('Dovršeno · čeka sinkronizaciju', { exact: true }),
    ).toBeVisible();
    await expect(
        timeline.getByText('Sljedeća stanica', { exact: true }),
    ).toBeVisible();
    await expect(
        timeline.getByText('Ponovni pokušaj', { exact: true }),
    ).toBeVisible();
    await expect(timeline.getByText('Iznimka', { exact: true })).toBeVisible();
    await expect(
        timeline.getByText('Čeka redoslijed', { exact: true }),
    ).toBeVisible();
    await expect(
        timeline.locator('li[data-route-state="current"] button'),
    ).toHaveAttribute('aria-current', 'step');
    await expect(timeline.getByRole('button').nth(4)).toHaveAccessibleName(
        /Stanica 5/,
    );
});

test('expands only one stop while leaving the current command in place', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<DriverRouteProgressTimelineStory />);

    const timeline = page.getByRole('list', {
        name: 'Tijek dostavne rute',
    });
    const triggers = timeline.getByRole('button');
    const command = page.getByTestId('current-command');
    const before = await command.boundingBox();

    await triggers.nth(2).click();
    await expect(triggers.nth(2)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('route-details')).toHaveText(
        /Detalji za stop-3/,
    );

    await triggers.nth(3).click();
    await expect(triggers.nth(2)).toHaveAttribute('aria-expanded', 'false');
    await expect(triggers.nth(3)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('route-details')).toHaveCount(1);
    await expect(page.getByTestId('route-details')).toHaveText(
        /Detalji za stop-4/,
    );

    const after = await command.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);

    await triggers.nth(3).click();
    await expect(page.getByTestId('route-details')).toHaveCount(0);
});

test('supports arrow, Home, and End keyboard navigation between stops', async ({
    mount,
    page,
}) => {
    await mount(<DriverRouteProgressTimelineStory />);

    const triggers = page
        .getByRole('list', { name: 'Tijek dostavne rute' })
        .getByRole('button');
    await triggers.nth(1).focus();
    await page.keyboard.press('ArrowDown');
    await expect(triggers.nth(2)).toBeFocused();
    await page.keyboard.press('End');
    await expect(triggers.nth(26)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(triggers.first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(triggers.nth(26)).toBeFocused();
});

test('keeps controlled map selection synchronized with the expanded timeline row', async ({
    mount,
    page,
}) => {
    await mount(<DriverRouteProgressTimelineStory />);
    const timeline = page.getByRole('list', {
        name: 'Tijek dostavne rute',
    });
    const fifthTrigger = timeline.getByRole('button').nth(4);

    await page
        .getByRole('button', { name: 'Odaberi stanicu 5 na karti' })
        .click();
    await expect(page.getByTestId('timeline-selection')).toHaveText('stop-5');
    await expect(fifthTrigger).toHaveAttribute('aria-expanded', 'true');

    await fifthTrigger.click();
    await expect(page.getByTestId('timeline-selection')).toHaveText('none');
    await expect(fifthTrigger).toHaveAttribute('aria-expanded', 'false');
});
