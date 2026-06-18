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

    const calendarControls = page
        .getByRole('button', { name: 'Prethodni mjesec' })
        .locator('xpath=..');

    await expect
        .poll(async () => (await calendarControls.textContent())?.trim())
        .toBe('');
    await expect(
        page.locator(
            'button:has([data-watering-calendar-today-marker]):has([data-watering-calendar-marker])',
        ),
    ).toHaveCount(1);
});
