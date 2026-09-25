import { autumnAsterPots } from '@gredice/js/autumnAsterPots';
import { expect, test } from '@playwright/experimental-ct-react';
import { AutumnAsterPotsFixture } from '../../../packages/game/tests/AutumnAsterPotsFixture';

for (const light of ['day', 'night', 'cloudy', 'dusk'] satisfies (
    | 'day'
    | 'night'
    | 'cloudy'
    | 'dusk'
)[]) {
    for (const rotation of [0, 1, 2, 3]) {
        test(`autumn asters beside a planted bed: ${light} ${rotation}`, async ({
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
                <AutumnAsterPotsFixture rotation={rotation} light={light} />,
            );
            await expect(fixture).toHaveAttribute('data-ready', /.+/);
            const data: {
                cropMeshes: number;
                pots: {
                    name: string;
                    rotationY: number;
                    minY: number;
                    height: number;
                    width: number;
                    depth: number;
                    color: string;
                    materialId: string;
                    x: number;
                    y: number;
                }[];
            } = JSON.parse((await fixture.getAttribute('data-ready')) ?? '{}');
            expect(data.cropMeshes).toBeGreaterThan(0);
            expect(data.pots).toHaveLength(3);
            expect(new Set(data.pots.map((pot) => pot.materialId)).size).toBe(
                3,
            );
            for (const pot of data.pots) {
                const config = autumnAsterPots.find(
                    (item) => item.name === pot.name,
                );
                expect(pot.color).toBe(config?.color.toLowerCase());
                expect(pot.rotationY).toBeCloseTo((rotation * Math.PI) / 2, 5);
                expect(pot.minY).toBeCloseTo(
                    pot.name.endsWith('Gold') ? 1.07 : 0.4,
                    3,
                );
                expect(pot.height).toBeGreaterThan(0.59);
                expect(pot.height).toBeLessThanOrEqual(0.61);
                expect(pot.width).toBeLessThanOrEqual(0.72);
                expect(pot.depth).toBeLessThanOrEqual(0.72);
                await fixture
                    .locator('canvas')
                    .click({ position: { x: pot.x, y: pot.y } });
                await expect(fixture).toHaveAttribute('data-hit', pot.name);
            }
            await page
                .getByRole('button', { name: 'Pregledaj rajčicu' })
                .click();
            await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
            await expect(fixture).toHaveScreenshot(`${light}-${rotation}.png`, {
                maxDiffPixels: light === 'night' ? 20 : 0,
            });
            expect(errors).toEqual([]);
        });
    }
}

test('autumn asters remain distinct on a small low-quality canvas', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <AutumnAsterPotsFixture rotation={0} small light="cloudy" />,
    );
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    await page.getByRole('button', { name: 'Pregledaj rajčicu' }).click();
    await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
    await expect(fixture).toHaveScreenshot('cloudy-small.png');
});
