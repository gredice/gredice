import type { Locator, Page } from '@playwright/test';

export function calendarMonthOffset(from: Date, to: Date) {
    return (
        (to.getFullYear() - from.getFullYear()) * 12 +
        to.getMonth() -
        from.getMonth()
    );
}

export function formatTestCalendarDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function selectCalendarDate({
    date,
    monthOffset = 0,
    page,
    trigger,
}: {
    date: string;
    monthOffset?: number;
    page: Page;
    trigger: Locator;
}) {
    await trigger.click();

    const calendar = page.getByRole('group', { name: 'Kalendar' }).last();
    await calendar.waitFor();

    const navigationButton = calendar.getByRole('button', {
        name: monthOffset < 0 ? 'Prethodni mjesec' : 'Sljedeći mjesec',
    });
    for (let index = 0; index < Math.abs(monthOffset); index += 1) {
        await navigationButton.click();
    }

    await calendar.locator(`[data-calendar-date="${date}"]`).click();
}
