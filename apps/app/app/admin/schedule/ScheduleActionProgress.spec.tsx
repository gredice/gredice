import { expect, test } from '@playwright/experimental-ct-react';
import { ScheduleActionQueueHarness } from '../../../playwright/ScheduleActionQueueHarness';

test('shows queued and running changes and hands off the final version after a multi-event completion', async ({
    mount,
    page,
}) => {
    const started: { id: number; status: string; expectedVersion: number }[] =
        [];
    const first = Promise.withResolvers<void>();
    await page.route('**/schedule-test-action', async (route) => {
        const body = route.request().postDataJSON();
        started.push(body);
        if (body.id === 1 && body.status === 'completed') await first.promise;
        await route.fulfill({
            json: {
                success: true,
                taskVersionEventId: body.expectedVersion + 2,
            },
        });
    });
    const component = await mount(<ScheduleActionQueueHarness />);
    await component.getByRole('button', { name: '1: completed' }).click();
    await expect(page.getByRole('status')).toHaveText('Obrada promjena: 1');
    await component.getByRole('button', { name: '1: canceled' }).click();
    await expect(page.getByRole('status')).toHaveText('Obrada promjena: 2');
    await component.getByRole('button', { name: '2: completed' }).click();
    await expect.poll(() => started.map(({ id }) => id)).toEqual([1, 2]);
    await expect(page.getByRole('status')).toHaveText('Obrada promjena: 2');
    await expect(component.getByTestId('value-1')).toHaveText('canceled');
    first.resolve();
    await expect.poll(() => started.length).toBe(3);
    expect(started[2]).toEqual({
        id: 1,
        status: 'canceled',
        expectedVersion: 12,
    });
    await expect(page.getByRole('status')).toHaveText(
        'Sve promjene rasporeda su obrađene.',
    );
});

test('restores a failed change and clears progress so the task can be retried', async ({
    mount,
    page,
}) => {
    const first = Promise.withResolvers<void>();
    let failed = false;
    await page.route('**/schedule-test-action', async (route) => {
        await first.promise;
        await route.fulfill({
            json: failed
                ? { success: true }
                : { success: false, message: 'Pokušajte ponovno.' },
        });
        failed = true;
    });
    const component = await mount(<ScheduleActionQueueHarness />);
    await component.getByRole('button', { name: '1: completed' }).click();
    await expect(component.getByTestId('value-1')).toHaveText('completed');
    await expect(page.getByRole('status')).toHaveText('Obrada promjena: 1');
    first.resolve();
    await expect(component.getByTestId('value-1')).toHaveText('planned');
    await expect(page.getByRole('status')).toHaveText(
        'Sve promjene rasporeda su obrađene.',
    );
    await component.getByRole('button', { name: '1: completed' }).click();
    await expect(component.getByTestId('value-1')).toHaveText('completed');
    await expect(page.getByRole('status')).toHaveText(
        'Sve promjene rasporeda su obrađene.',
    );
});

test('bulk request rejection alerts after every target settles and preserves successful versions', async ({
    mount,
    page,
}) => {
    const slow = Promise.withResolvers<void>();
    const started: { id: number; status: string; expectedVersion: number }[] =
        [];
    const alerts: string[] = [];
    page.on('dialog', async (dialog) => {
        alerts.push(dialog.message());
        await dialog.accept();
    });
    await page.route('**/schedule-test-action', async (route) => {
        const body = route.request().postDataJSON();
        started.push(body);
        if (body.id === 1) {
            await route.abort('failed');
            return;
        }
        if (body.status === 'completed') await slow.promise;
        await route.fulfill({
            json: { success: true, taskVersionEventId: 14 },
        });
    });
    const component = await mount(<ScheduleActionQueueHarness />);
    await component.getByRole('button', { name: 'Complete both' }).click();
    await expect.poll(() => started.length).toBe(2);
    await component.getByRole('button', { name: '2: canceled' }).click();
    await expect(page.getByRole('status')).toHaveText('Obrada promjena: 2');
    expect(alerts).toEqual([]);
    slow.resolve();
    await expect.poll(() => alerts).toEqual(['Skupna promjena nije uspjela.']);
    await expect.poll(() => started.length).toBe(3);
    expect(started[2]).toEqual({
        id: 2,
        status: 'canceled',
        expectedVersion: 14,
    });
    await expect(component.getByTestId('value-1')).toHaveText('planned');
    await expect(component.getByTestId('value-2')).toHaveText('canceled');
    await expect(page.getByRole('status')).toHaveText(
        'Sve promjene rasporeda su obrađene.',
    );
});
