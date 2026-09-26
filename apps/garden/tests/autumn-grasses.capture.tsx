import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { AutumnGrassesFixture } from '../../../packages/game/tests/AutumnGrassesFixture';

async function checkClusters(
    fixture: Locator,
    page: Page,
    rotation: number,
    weather = '',
    raised = false,
) {
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    const data: {
        cropMeshes: number;
        clusters: {
            id: string;
            rotation: number;
            minY: number;
            height: number;
            width: number;
            depth: number;
            materialId: string;
            anchor: number[];
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
    expect(data.clusters).toHaveLength(2);
    expect(new Set(data.clusters.map((item) => item.materialId)).size).toBe(2);
    for (const item of data.clusters) {
        expect(item.vertexColors).toBe(true);
        expect(item.colorCount).toBeGreaterThan(0);
        expect(item.triangles).toBe(item.id === 'grass-tuft' ? 1020 : 1440);
        expect(item.anchor).toEqual([0, 0.031, 0]);
        expect(item.rotation).toBeCloseTo((rotation * Math.PI) / 2, 5);
        expect(item.minY).toBeCloseTo(raised ? 1.07 : 0.4, 3);
        expect(item.height).toBeGreaterThan(
            item.id === 'grass-tuft' ? 0.29 : 0.64,
        );
        expect(item.height).toBeLessThanOrEqual(
            item.id === 'grass-tuft' ? 0.35 : 0.7,
        );
        expect(item.width).toBeLessThanOrEqual(0.9);
        expect(item.depth).toBeLessThanOrEqual(0.9);
        if (weather === 'rain') expect(item.rain).toBeGreaterThan(0);
        if (weather === 'snow') expect(item.snow).toBeGreaterThan(0);
        await fixture
            .locator('canvas')
            .click({ position: { x: item.x, y: item.y } });
        await expect(fixture).toHaveAttribute('data-hit', item.id);
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
        test(`autumn grasses ${light} ${rotation}`, async ({ mount, page }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const fixture = await mount(
                <AutumnGrassesFixture rotation={rotation} light={light} />,
            );
            await checkClusters(fixture, page, rotation);
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
    test(`autumn grasses ${light}`, async ({ mount, page }) => {
        const fixture = await mount(
            <AutumnGrassesFixture rotation={0} light={light} />,
        );
        await checkClusters(fixture, page, 0, light);
        if (light === 'rain' || light === 'snow') {
            await fixture.screenshot({
                path: `../../docs/autumn-grasses-2026/${light}.png`,
            });
        } else {
            await expect(fixture).toHaveScreenshot(`${light}.png`);
        }
    });
}
test('autumn grasses small low-quality canvas', async ({ mount, page }) => {
    const fixture = await mount(
        <AutumnGrassesFixture rotation={0} light="cloudy" small />,
    );
    await checkClusters(fixture, page, 0);
    await expect(fixture).toHaveScreenshot('small.png');
});

for (const rotation of [0, 1, 2, 3]) {
    test(`autumn grasses raised supports ${rotation}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnGrassesFixture rotation={rotation} raised />,
        );
        await checkClusters(fixture, page, rotation, '', true);
    });
}
