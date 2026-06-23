import { expect, test } from '@playwright/experimental-ct-react';
import { WateringOperationsCalendar } from '../../../packages/game/src/hud/raisedBed/WateringOperationsCalendar';
import type { WateringCalendarEntry } from '../../../packages/game/src/hud/raisedBed/wateringCalendarModel';

const wateringEntries: WateringCalendarEntry[] = [
    {
        id: 'today',
        date: '2026-06-18T08:00:00.000Z',
        label: 'Današnje zalijevanje',
        source: 'completed',
        weight: 30,
    },
    {
        id: 'upcoming',
        date: '2026-06-22T08:00:00.000Z',
        label: 'Sljedeće zalijevanje',
        source: 'scheduled',
        weight: 18,
    },
    {
        id: 'preview',
        date: '2026-06-23T08:00:00.000Z',
        label: 'Novi termin zalijevanja',
        source: 'preview',
        weight: 24,
    },
];

test('watering calendar keeps the header quiet and highlights today with watering', async ({
    mount,
    page,
}) => {
    await mount(
        <WateringOperationsCalendar
            entries={wateringEntries}
            referenceDate={new Date('2026-06-18T12:00:00.000Z')}
        />,
    );

    await expect(page.locator('[data-watering-calendar]')).toBeVisible();
    await expect(page.getByText('Kalendar zalijevanja')).toHaveCount(0);

    await expect
        .poll(async () =>
            (
                await page
                    .locator('[data-event-calendar-month="2026-06"]')
                    .locator('div')
                    .first()
                    .textContent()
            )?.trim(),
        )
        .toContain('lipanj 2026.');
    await expect(
        page.locator(
            'button:has([data-event-calendar-today-marker]):has([data-event-calendar-marker])',
        ),
    ).toHaveCount(1);
    await expect(
        page.locator('[data-event-calendar-today-marker]'),
    ).toHaveClass(/bg-muted/);
    await expect(
        page.locator('[data-event-calendar-marker]').first(),
    ).toHaveClass(/bg-sky-600/);

    const scheduledMarker = page.locator(
        '[data-event-calendar-tone="scheduled"]',
    );
    await expect(scheduledMarker).toHaveClass(/bg-sky-600/);
    await expect(scheduledMarker).toHaveCSS('height', '6px');
    await expect(scheduledMarker).toHaveCSS('width', '6px');

    await expect(
        page.locator('[data-event-calendar-tone="preview"]'),
    ).toHaveClass(/bg-sky-600/);
});

test('watering calendar opens day details on mobile tap', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 720 });
    await mount(
        <WateringOperationsCalendar
            entries={wateringEntries}
            referenceDate={new Date('2026-06-18T12:00:00.000Z')}
        />,
    );

    await page.getByRole('button', { name: /Sljedeće zalijevanje/ }).click();

    await expect(page.getByText('Sljedeće zalijevanje')).toBeVisible();
    await expect(page.getByText('Zakazano', { exact: true })).toBeVisible();
    await expect(page.getByText(/18 min/)).toHaveCount(0);
});
