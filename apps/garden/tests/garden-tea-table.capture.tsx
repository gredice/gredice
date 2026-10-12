import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { GardenTeaTableFixture } from '../../../packages/game/tests/GardenTeaTableFixture';

async function checkTable(
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
        expect(item.triangles).toBe(1280);
        expect(item.rotation).toBeCloseTo((rotation * Math.PI) / 2, 5);
        expect(item.minY).toBeCloseTo(raised ? 1.07 : 0.4, 3);
        expect(item.height).toBeGreaterThan(0.95);
        expect(item.height).toBeLessThanOrEqual(1);
        expect(item.width).toBeLessThanOrEqual(0.9);
        expect(item.depth).toBeLessThanOrEqual(0.9);
        expect(item.minX).toBeGreaterThanOrEqual(-2.45);
        expect(item.minZ).toBeGreaterThanOrEqual(-1.45);
        expect(item.maxX).toBeLessThanOrEqual(-1.55);
        expect(item.maxZ).toBeLessThanOrEqual(-0.55);
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

const mutationRequests = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
    const writes: string[] = [];
    mutationRequests.set(page, writes);
    page.on('pageerror', (error) => console.error(error.stack));
    await page.route('**/*', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method()))
            writes.push(`${request.method()} ${url.pathname}`);
        if (
            !['localhost', '127.0.0.1'].includes(url.hostname) ||
            !['GET', 'HEAD'].includes(request.method())
        )
            return route.abort();
        return route.continue();
    });
});

test.afterEach(async ({ page }) => {
    expect(mutationRequests.get(page)).toEqual([]);
});

for (const light of ['day', 'night'] satisfies ('day' | 'night')[]) {
    for (const rotation of [0, 1, 2, 3]) {
        test(`tea table ${light} ${rotation}`, async ({ mount, page }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const fixture = await mount(
                <GardenTeaTableFixture rotation={rotation} light={light} />,
            );
            await checkTable(fixture, page, rotation);
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
    test(`tea table ${light}`, async ({ mount, page }) => {
        const fixture = await mount(
            <GardenTeaTableFixture rotation={0} light={light} />,
        );
        await checkTable(fixture, page, 0, light);
        if (light === 'rain' || light === 'snow') {
            await fixture.screenshot({
                path: `../../docs/garden-tea-table-2026/${light}.png`,
            });
        } else {
            await expect(fixture).toHaveScreenshot(`${light}.png`);
        }
    });
}
test('tea table small low-quality canvas', async ({ mount, page }) => {
    const fixture = await mount(
        <GardenTeaTableFixture rotation={0} light="cloudy" small />,
    );
    await checkTable(fixture, page, 0);
    await expect(fixture).toHaveScreenshot('small.png');
});

for (const rotation of [0, 1, 2, 3]) {
    test(`tea table raised supports ${rotation}`, async ({ mount, page }) => {
        const fixture = await mount(
            <GardenTeaTableFixture rotation={rotation} raised />,
        );
        await checkTable(fixture, page, rotation, '', true);
    });
}
