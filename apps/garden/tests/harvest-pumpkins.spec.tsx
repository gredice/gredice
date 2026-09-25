import { expect, test } from '@playwright/experimental-ct-react';
import { HarvestPumpkinFixture } from '../../../packages/game/tests/HarvestPumpkinFixture';

for (const night of [false, true]) {
    for (const rotation of [0, 1, 2, 3]) {
        test(`fixed colours, ray selection and ground contact: ${night ? 'night' : 'day'} ${rotation}`, async ({
            mount,
            page,
        }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => {
                errors.push(error.message);
                console.error(error.message);
            });
            await page.route('**/*', (route) => {
                const request = route.request();
                const url = new URL(request.url());
                if (
                    !['localhost', '127.0.0.1'].includes(url.hostname) ||
                    !['GET', 'HEAD'].includes(request.method())
                ) {
                    errors.push(
                        `Unexpected request: ${request.method()} ${url.origin}${url.pathname}`,
                    );
                    return route.abort();
                }
                return route.continue();
            });
            const fixture = await mount(
                <HarvestPumpkinFixture rotation={rotation} night={night} />,
            );
            await expect(fixture).toHaveAttribute('data-ready', /.+/);
            const items: {
                name: string;
                rotationY: number;
                minY: number;
                height: number;
                x: number;
                y: number;
            }[] = JSON.parse(
                (await fixture.getAttribute('data-ready')) ?? '[]',
            );
            expect(items).toHaveLength(9);
            for (const item of items) {
                expect(item.rotationY).toBeCloseTo((rotation * Math.PI) / 2, 5);
                expect(item.minY).toBeCloseTo(0.4, 3);
                expect(item.height).toBeGreaterThan(0.39);
                expect(item.height).toBeLessThan(0.55);
                await fixture
                    .locator('canvas')
                    .click({ position: { x: item.x, y: item.y } });
                await expect(fixture).toHaveAttribute('data-hit', item.name);
            }
            await expect(fixture.locator('canvas')).toHaveScreenshot(
                `${night ? 'night' : 'day'}-${rotation}.png`,
                // The existing night sky randomly places a few one-pixel stars.
                { animations: 'disabled', maxDiffPixels: night ? 20 : 0 },
            );
            expect(errors).toEqual([]);
        });
    }
}

test('all three silhouettes read on a small low-quality canvas', async ({
    mount,
}) => {
    const fixture = await mount(<HarvestPumpkinFixture rotation={0} small />);
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    await expect(fixture.locator('canvas')).toHaveScreenshot('day-small.png');
});
