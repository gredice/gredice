import { expect, test } from '@playwright/experimental-ct-react';
import { HarvestCratesFixture } from '../../../packages/game/tests/HarvestCratesFixture';

for (const night of [false, true]) {
    for (const rotation of [0, 1, 2, 3]) {
        test(`harvest crates on the ground and display tables: ${night ? 'night' : 'day'} ${rotation}`, async ({
            mount,
            page,
        }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
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
                <HarvestCratesFixture rotation={rotation} night={night} />,
            );
            await expect(fixture).toHaveAttribute('data-ready', /.+/);
            const crates: {
                id: string;
                meshes: number;
                rotationY: number;
                minY: number;
                height: number;
                x: number;
                y: number;
            }[] = JSON.parse(
                (await fixture.getAttribute('data-ready')) ?? '[]',
            );
            expect(crates).toHaveLength(4);
            for (const crate of crates) {
                expect(crate.meshes).toBeGreaterThanOrEqual(5);
                expect(crate.rotationY).toBeCloseTo(
                    (rotation * Math.PI) / 2,
                    5,
                );
                expect(crate.minY).toBeCloseTo(
                    crate.id.endsWith('table') ? 1.07 : 0.4,
                    3,
                );
                expect(crate.height).toBeGreaterThan(0.43);
                expect(crate.height).toBeLessThanOrEqual(
                    crate.id.startsWith('pumpkins') ? 0.44 : 0.5,
                );
                await fixture
                    .locator('canvas')
                    .click({ position: { x: crate.x, y: crate.y } });
                await expect(fixture).toHaveAttribute('data-hit', crate.id);
            }
            await expect(fixture).toHaveScreenshot(
                `${night ? 'night' : 'day'}-${rotation}.png`,
                { maxDiffPixels: night ? 20 : 0 },
            );
            expect(errors).toEqual([]);
        });
    }
}

test('harvest crates remain distinct on a small low-quality canvas', async ({
    mount,
}) => {
    const fixture = await mount(<HarvestCratesFixture rotation={0} small />);
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    await expect(fixture).toHaveScreenshot('day-small.png');
});
