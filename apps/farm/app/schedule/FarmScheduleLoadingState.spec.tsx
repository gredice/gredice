import { expect, test } from '@playwright/experimental-ct-react';
import '../globals.css';
import { FarmScheduleLoadingState } from './FarmScheduleLoadingState';

for (const width of [320, 1280]) {
    test(`keeps the schedule summary skeleton within ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 800 });
        const component = await mount(<FarmScheduleLoadingState />);

        await expect(
            component.getByRole('heading', { level: 1, name: 'Raspored' }),
        ).toBeVisible();

        expect(
            await page.evaluate(
                () =>
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
            ),
        ).toBe(true);
    });
}
