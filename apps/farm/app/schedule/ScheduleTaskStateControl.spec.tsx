import { expect, test } from '@playwright/experimental-ct-react';
import { ScheduleTaskStateControl } from './ScheduleTaskStateControl';

for (const width of [320, 1280]) {
    test(`keeps submitted work non-actionable at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 640 });
        const component = await mount(
            <ScheduleTaskStateControl
                action={<button type="button">Dovrši</button>}
                label="Zalij gredicu broj 12"
                state="pendingVerification"
                unavailableTitle="Radnja nije dostupna."
            />,
        );

        await expect(component.getByRole('button')).toHaveCount(0);
        await expect(component.getByRole('checkbox')).toHaveCount(0);
    });
}

test('renders only verified work as checked completion', async ({ mount }) => {
    const component = await mount(
        <ScheduleTaskStateControl
            label="Posij mrkvu"
            state="completed"
            unavailableTitle="Sijanje nije dostupno."
        />,
    );

    const checkbox = component.getByRole('checkbox', {
        name: 'Potvrđeno: Posij mrkvu',
    });
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();
});

test('keeps actionable controls available and names locked work', async ({
    mount,
    page,
}) => {
    const actionable = await mount(
        <ScheduleTaskStateControl
            action={<button type="button">Dovrši</button>}
            label="Zalij salatu"
            state="actionable"
            unavailableTitle="Radnja nije dostupna."
        />,
    );
    await expect(page.getByRole('button', { name: 'Dovrši' })).toBeVisible();
    await actionable.unmount();

    await mount(
        <ScheduleTaskStateControl
            label="Zalij salatu"
            state="actionable"
            unavailableTitle="Radnja je dodijeljena drugom korisniku."
        />,
    );
    await expect(
        page.getByRole('checkbox', {
            name: 'Nije dostupno: Zalij salatu. Radnja je dodijeljena drugom korisniku.',
        }),
    ).toBeDisabled();
});
