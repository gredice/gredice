import { expect, test } from '@playwright/experimental-ct-react';
import '../globals.css';
import { ScheduleDaySummaryView } from './ScheduleDaySummary';
import { getScheduleTaskSummary } from './scheduleTaskState';

const summary = getScheduleTaskSummary([
    { state: 'actionable', durationMinutes: 75 },
    { state: 'pendingVerification', durationMinutes: 5 },
    { state: 'completed', durationMinutes: 5 },
    { state: 'blocked', durationMinutes: 5 },
    { state: 'failed', durationMinutes: 5 },
    { state: 'canceled', durationMinutes: 5 },
]);

for (const width of [320, 390]) {
    test(`keeps every daily status within ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 640 });
        const component = await mount(
            <ScheduleDaySummaryView summary={summary} />,
        );

        const group = component;
        await expect(group).toHaveAttribute(
            'aria-label',
            'Sažetak dnevnih zadataka',
        );
        await expect(
            component.getByText('Preostalo', { exact: true }),
        ).toBeVisible();
        await expect(component.getByText('Čeka potvrdu')).toBeVisible();
        await expect(component.getByText('Potvrđeno')).toBeVisible();
        await expect(component.getByText('Preostalo vrijeme')).toBeVisible();
        await expect(component.getByText('Blokirano')).toBeVisible();
        await expect(component.getByText('Neuspjelo')).toBeVisible();
        await expect(component.getByText('Otkazano')).toBeVisible();

        expect(
            await group.evaluate((element) => {
                const groupBounds = element.getBoundingClientRect();
                const itemBounds = Array.from(element.children).map((child) =>
                    child.getBoundingClientRect(),
                );

                return (
                    groupBounds.left >= 0 &&
                    groupBounds.right <= window.innerWidth &&
                    itemBounds.every(
                        (bounds) =>
                            bounds.left >= groupBounds.left &&
                            bounds.right <= groupBounds.right,
                    )
                );
            }),
        ).toBe(true);
    });
}
