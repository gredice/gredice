import { expect, test } from '@playwright/experimental-ct-react';
import { StarsDepthFixture } from '../../../packages/game/tests/StarsDepthFixture';

for (const view of ['overview', 'third-person', 'first-person'] as const) {
    test(`stars stay behind opaque blocks in ${view}`, async ({
        mount,
        page,
    }) => {
        test.setTimeout(60_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        const fixture = await mount(<StarsDepthFixture view={view} />);
        const litPixels = async () =>
            Number(
                await page.locator('canvas').getAttribute('data-lit-pixels'),
            );
        await expect.poll(litPixels, { timeout: 30_000 }).toBeGreaterThan(0);
        await fixture.update(<StarsDepthFixture view={view} occluded />);
        await expect.poll(litPixels).toBe(0);
        await fixture.update(<StarsDepthFixture view={view} />);
        await expect.poll(litPixels).toBeGreaterThan(0);
        expect(errors).toEqual([]);
    });
}
