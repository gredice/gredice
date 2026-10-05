import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { AutumnBlanketBenchFixture } from '../../../packages/game/tests/AutumnBlanketBenchFixture';

async function checkLog(
    fixture: Locator,
    page: Page,
    rotation: number,
    weather = '',
    raised = false,
) {
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    const data: {
        cropMeshes: number;
        neighbors: { id: string; x: number; y: number }[];
        clusters: {
            id: string;
            rotation: number;
            minY: number;
            minX: number;
            maxX: number;
            minZ: number;
            maxZ: number;
            height: number;
            width: number;
            depth: number;
            materialId: string;
            vertexColors: boolean;
            colorCount: number;
            triangles: number;
            snow: number;
            rain: number;
            x: number;
            y: number;
        }[];
    } = JSON.parse((await fixture.getAttribute('data-ready')) ?? '{}');
    expect(data.cropMeshes).toBeGreaterThan(0);
    expect(data.clusters).toHaveLength(1);
    expect(new Set(data.clusters.map((item) => item.materialId)).size).toBe(1);
    for (const item of data.clusters) {
        expect(item.vertexColors).toBe(true);
        expect(item.colorCount).toBeGreaterThan(0);
        expect(item.triangles).toBe(1768);
        expect(item.rotation).toBeCloseTo((rotation * Math.PI) / 2, 5);
        expect(item.minY).toBeCloseTo(raised ? 1.07 : 0.4, 3);
        expect(item.height).toBeGreaterThan(0.42);
        expect(item.height).toBeLessThanOrEqual(0.45);
        expect(item.width).toBeLessThanOrEqual(rotation % 2 ? 0.5 : 1.2);
        expect(item.depth).toBeLessThanOrEqual(rotation % 2 ? 1.2 : 0.5);
        expect(item.minX).toBeGreaterThanOrEqual(-2.45);
        expect(item.minZ).toBeGreaterThanOrEqual(-1.45);
        expect(item.maxX).toBeLessThanOrEqual(rotation % 2 ? -1.55 : -0.55);
        expect(item.maxZ).toBeLessThanOrEqual(rotation % 2 ? 0.45 : -0.55);
        if (weather === 'rain') expect(item.rain).toBeGreaterThan(0);
        if (weather === 'snow') expect(item.snow).toBeGreaterThan(0);
        await fixture
            .locator('canvas')
            .click({ position: { x: item.x, y: item.y } });
        await expect(fixture).toHaveAttribute('data-hit', item.id);
    }
    for (const neighbor of data.neighbors) {
        await fixture
            .locator('canvas')
            .click({ position: { x: neighbor.x, y: neighbor.y } });
        await expect(fixture).toHaveAttribute('data-hit', neighbor.id);
    }
    await page.getByRole('button', { name: 'Pregledaj rajčicu' }).click();
    await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => console.error(error.stack));
    await page.route('**/*', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
            !['localhost', '127.0.0.1'].includes(url.hostname) ||
            !['GET', 'HEAD'].includes(request.method())
        )
            return route.abort();
        return route.continue();
    });
});

for (const light of ['day', 'night'] satisfies ('day' | 'night')[]) {
    for (const rotation of [0, 1, 2, 3]) {
        test(`blanket bench ${light} ${rotation}`, async ({ mount, page }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const fixture = await mount(
                <AutumnBlanketBenchFixture rotation={rotation} light={light} />,
            );
            await checkLog(fixture, page, rotation);
            await expect(fixture).toHaveScreenshot(`${light}-${rotation}.png`, {
                maxDiffPixels: light === 'night' ? 20 : 0,
            });
            expect(errors).toEqual([]);
        });
    }
}
for (const light of ['cloudy', 'dusk', 'rain', 'snow'] satisfies (
    | 'cloudy'
    | 'dusk'
    | 'rain'
    | 'snow'
)[]) {
    test(`blanket bench ${light}`, async ({ mount, page }) => {
        const fixture = await mount(
            <AutumnBlanketBenchFixture rotation={0} light={light} />,
        );
        await checkLog(fixture, page, 0, light);
        if (light === 'rain' || light === 'snow') {
            await fixture.screenshot({
                path: `../../docs/autumn-blanket-bench-2026/${light}.png`,
            });
        } else {
            await expect(fixture).toHaveScreenshot(`${light}.png`);
        }
    });
}
test('blanket bench small low-quality canvas', async ({ mount, page }) => {
    const fixture = await mount(
        <AutumnBlanketBenchFixture rotation={0} light="cloudy" small />,
    );
    await checkLog(fixture, page, 0);
    await expect(fixture).toHaveScreenshot('small.png');
});

for (const rotation of [0, 1, 2, 3]) {
    test(`blanket bench raised supports ${rotation}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnBlanketBenchFixture rotation={rotation} raised />,
        );
        await checkLog(fixture, page, rotation, '', true);
    });
}
