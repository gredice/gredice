import { expect, test } from '@playwright/experimental-ct-react';
import { ScheduleTaskCompletionButton } from './ScheduleTaskCompletionButton';

for (const width of [320, 375, 390, 430]) {
    test(`keeps real completion triggers explicit and touchable at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 640 });
        const component = await mount(
            <div className="space-y-2 p-2">
                <ScheduleTaskCompletionButton
                    actionLabel="Dovrši radnju"
                    label="Vrlo duga radnja pripreme zemlje za jesensku sadnju"
                />
                <ScheduleTaskCompletionButton
                    actionLabel="Dovrši sijanje"
                    label="Vrlo duga sorta rajčice za sijanje u stakleniku"
                />
            </div>,
        );

        const buttons = component.getByRole('button');
        await expect(buttons).toHaveCount(2);
        await expect(
            component.getByRole('button', {
                name: 'Dovrši radnju: Vrlo duga radnja pripreme zemlje za jesensku sadnju',
            }),
        ).toBeVisible();
        await expect(
            component.getByRole('button', {
                name: 'Dovrši sijanje: Vrlo duga sorta rajčice za sijanje u stakleniku',
            }),
        ).toBeVisible();

        const undersizedOrClipped = await buttons.evaluateAll((targets) =>
            targets.filter((target) => {
                const bounds = target.getBoundingClientRect();
                return (
                    bounds.width < 44 ||
                    bounds.height < 44 ||
                    bounds.left < 0 ||
                    bounds.right > window.innerWidth
                );
            }),
        );
        expect(undersizedOrClipped).toEqual([]);
    });
}
