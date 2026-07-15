import { expect, test } from '@playwright/experimental-ct-react';
import '../globals.css';
import { ScheduleTaskStatusChip } from './ScheduleTaskStatusChip';
import type { ScheduleTaskState } from './scheduleTaskState';

const visibleStates: Exclude<ScheduleTaskState, 'actionable'>[] = [
    'pendingVerification',
    'completed',
    'failed',
    'canceled',
];

test('renders every terminal and review state with visible text', async ({
    mount,
}) => {
    const component = await mount(
        <div className="flex max-w-full flex-wrap gap-2">
            {visibleStates.map((state) => (
                <ScheduleTaskStatusChip key={state} state={state} />
            ))}
        </div>,
    );

    await expect(component.getByText('Čeka potvrdu')).toBeVisible();
    await expect(component.getByText('Potvrđeno')).toBeVisible();
    await expect(component.getByText('Neuspjelo')).toBeVisible();
    await expect(component.getByText('Otkazano')).toBeVisible();
});

test('keeps the pending label visible at a phone viewport', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const component = await mount(
        <div className="flex w-full max-w-full flex-wrap gap-2">
            {visibleStates.map((state) => (
                <ScheduleTaskStatusChip key={state} state={state} />
            ))}
        </div>,
    );

    const pending = component.getByText('Čeka potvrdu');
    await expect(pending).toBeVisible();
    await expect(
        component.locator('[data-task-state="pendingVerification"]'),
    ).toHaveCount(1);
    expect(
        await page.evaluate(
            () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
        ),
    ).toBe(true);
});
