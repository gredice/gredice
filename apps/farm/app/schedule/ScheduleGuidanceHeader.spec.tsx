import { Button } from '@gredice/ui/Button';
import { expect, test } from '@playwright/experimental-ct-react';
import '../globals.css';
import { ScheduleGuidanceHeader } from './ScheduleGuidanceHeader';

const longTitle =
    'Iznimno dugačak naziv sorte rajčice za detaljne upute na uskom telefonu';

async function expectContainedAndTouchable(
    component: import('@playwright/test').Locator,
) {
    expect(
        await component.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return (
                bounds.left >= 0 &&
                bounds.right <= window.innerWidth &&
                element.scrollWidth <= element.clientWidth
            );
        }),
    ).toBe(true);

    const undersizedTargets = await component
        .locator('a[href], button')
        .evaluateAll((targets) =>
            targets.filter((target) => {
                const bounds = target.getBoundingClientRect();
                return bounds.width < 44 || bounds.height < 44;
            }),
        );
    expect(undersizedTargets).toEqual([]);
}

test('keeps contextual return, long title, and trailing action usable at 320px', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const component = await mount(
        <ScheduleGuidanceHeader
            fallbackHref="/plants"
            fallbackTitle="Povratak na biljke"
            scheduleReturnHref="/schedule?date=2026-07-20#schedule-task-planting-81"
            title={longTitle}
            trailingAction={
                <Button href="https://example.test" size="lg">
                    www
                </Button>
            }
        />,
    );

    await expect(
        component.getByRole('link', { name: 'Natrag na raspored' }),
    ).toHaveAttribute(
        'href',
        '/schedule?date=2026-07-20#schedule-task-planting-81',
    );
    await expect(
        component.getByRole('heading', { name: longTitle }),
    ).toBeVisible();
    await expectContainedAndTouchable(component);
});

test('keeps the direct handbook fallback target phone-sized', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const component = await mount(
        <ScheduleGuidanceHeader
            fallbackHref="/operations"
            fallbackTitle="Povratak na priručnik radnji"
            scheduleReturnHref={null}
            title={longTitle}
        />,
    );

    await expect(
        component.getByRole('link', {
            name: 'Povratak na priručnik radnji',
        }),
    ).toBeVisible();
    await expectContainedAndTouchable(component);
});
