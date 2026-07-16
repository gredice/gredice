import { Button } from '@gredice/ui/Button';
import { expect, test } from '@playwright/experimental-ct-react';
import { ScheduleTaskStateControl } from './ScheduleTaskStateControl';

for (const width of [320, 1280]) {
    test(`keeps submitted and verified work non-actionable at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 640 });
        const component = await mount(
            <div>
                <ScheduleTaskStateControl
                    action={
                        <Button size="lg" type="button">
                            Dovrši
                        </Button>
                    }
                    actionLabel="Dovrši radnju"
                    label="Zalij gredicu broj 12"
                    state="pendingVerification"
                    unavailableTitle="Radnja nije dostupna."
                />
                <ScheduleTaskStateControl
                    actionLabel="Dovrši radnju"
                    label="Zalij gredicu broj 13"
                    state="completed"
                    unavailableTitle="Radnja nije dostupna."
                />
            </div>,
        );

        await expect(component.getByRole('button')).toHaveCount(0);
        await expect(component.getByRole('checkbox')).toHaveCount(0);
    });
}

test('keeps actionable controls available and names locked work', async ({
    mount,
    page,
}) => {
    const actionable = await mount(
        <ScheduleTaskStateControl
            action={
                <Button fullWidth size="lg" type="button">
                    Dovrši
                </Button>
            }
            actionLabel="Dovrši radnju"
            label="Zalij salatu"
            state="actionable"
            unavailableTitle="Radnja nije dostupna."
        />,
    );
    await expect(page.getByRole('button', { name: 'Dovrši' })).toBeVisible();
    await actionable.unmount();

    await mount(
        <ScheduleTaskStateControl
            actionLabel="Dovrši radnju"
            label="Zalij salatu"
            state="actionable"
            unavailableTitle="Radnja je dodijeljena drugom korisniku."
        />,
    );
    const lockedButton = page.getByRole('button', {
        name: 'Nije dostupno: Dovrši radnju za Zalij salatu. Radnja je dodijeljena drugom korisniku.',
    });
    await expect(lockedButton).toBeDisabled();
    await expect(
        page.getByText('Radnja je dodijeljena drugom korisniku.'),
    ).toBeVisible();
    expect(
        await lockedButton.evaluate(
            (button) => button.getBoundingClientRect().height,
        ),
    ).toBeGreaterThanOrEqual(44);
});

test('keeps a loading completion action large and unavailable to repeat input', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const component = await mount(
        <ScheduleTaskStateControl
            action={
                <Button aria-busy fullWidth loading size="lg" type="button">
                    Dovrši radnju
                </Button>
            }
            actionLabel="Dovrši radnju"
            label="Vrlo duga radnja zalijevanja rajčice"
            state="actionable"
            unavailableTitle="Radnja nije dostupna."
        />,
    );

    const loadingButton = component.getByRole('button');
    await expect(loadingButton).toBeDisabled();
    await expect(loadingButton).toHaveAttribute('aria-busy', 'true');
    expect(
        await loadingButton.evaluate(
            (button) => button.getBoundingClientRect().height,
        ),
    ).toBeGreaterThanOrEqual(44);
});
