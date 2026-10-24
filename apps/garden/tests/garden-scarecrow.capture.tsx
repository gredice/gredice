import { expect, test } from '@playwright/experimental-ct-react';
import { GardenScarecrowFixture } from '../../../packages/game/tests/GardenScarecrowFixture';

for (const night of [false, true]) {
    for (const rotation of [0, 1, 2, 3]) {
        test(`scarecrow beside a planted bed: ${night ? 'night' : 'day'} ${rotation}`, async ({
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
                <GardenScarecrowFixture rotation={rotation} night={night} />,
            );
            await expect(fixture).toHaveAttribute('data-ready', /.+/);
            const data: {
                cropMeshes: number;
                cropHeight: number;
                rotationY: number;
                minY: number;
                height: number;
                x: number;
                y: number;
                left: number;
                right: number;
                top: number;
                bottom: number;
            } = JSON.parse((await fixture.getAttribute('data-ready')) ?? '{}');
            expect(data.cropMeshes).toBeGreaterThan(0);
            expect(data.cropHeight).toBeGreaterThan(0.05);
            expect(data.rotationY).toBeCloseTo((rotation * Math.PI) / 2, 5);
            expect(data.minY).toBeCloseTo(0.4, 3);
            expect(data.height).toBeGreaterThan(1.4);
            expect(data.height).toBeLessThanOrEqual(1.41);
            const canvas = fixture.locator('canvas');
            await canvas.click({ position: { x: data.x, y: data.y } });
            await expect(fixture).toHaveAttribute(
                'data-hit',
                'GardenScarecrow',
            );
            const button = page.getByRole('button', {
                name: 'Pregledaj rajčicu',
            });
            const control = await button.boundingBox();
            const canvasBox = await canvas.boundingBox();
            expect(control).not.toBeNull();
            expect(canvasBox).not.toBeNull();
            if (control && canvasBox) {
                expect(
                    control.x + control.width < canvasBox.x + data.left ||
                        control.x > canvasBox.x + data.right ||
                        control.y + control.height < canvasBox.y + data.top ||
                        control.y > canvasBox.y + data.bottom,
                ).toBe(true);
            }
            await button.click();
            await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
            await expect(fixture).toHaveScreenshot(
                `${night ? 'night' : 'day'}-${rotation}.png`,
                { maxDiffPixels: night ? 20 : 0 },
            );
            expect(errors).toEqual([]);
        });
    }
}

test('scarecrow and crop control remain readable on a small low-quality canvas', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<GardenScarecrowFixture rotation={0} small />);
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    await page.getByRole('button', { name: 'Pregledaj rajčicu' }).click();
    await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
    await expect(fixture).toHaveScreenshot('day-small.png');
});
