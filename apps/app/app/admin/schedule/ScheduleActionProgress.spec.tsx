import { expect, test } from '@playwright/experimental-ct-react';
import { ScheduleActionQueueHarness } from '../../../playwright/ScheduleActionQueueHarness';

test('shows queued and running changes, serializes a target and hands off its version', async ({
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
        await route.fulfill({ json: { success: true } });
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
        expectedVersion: 11,
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
