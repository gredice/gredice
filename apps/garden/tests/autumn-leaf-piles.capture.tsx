import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { AutumnLeafPilesFixture } from '../../../packages/game/tests/AutumnLeafPilesFixture';

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
        ambientLeaves: number;
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
        expect(item.triangles).toBe(item.id === 'pile-mound' ? 198 : 248);
        expect(item.anchor).toEqual(
            item.id === 'pile-mound' ? [0, 0.1, 0] : [0.24, 0.1, 0],
        );
        expect(item.rotation).toBeCloseTo((rotation * Math.PI) / 2, 5);
        expect(item.minY).toBeCloseTo(raised ? 1.07 : 0.4, 3);
        expect(item.height).toBeGreaterThan(0.12);
        expect(item.height).toBeLessThanOrEqual(0.18);
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
        test(`autumn leaf piles ${light} ${rotation}`, async ({
            mount,
            page,
        }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const fixture = await mount(
                <AutumnLeafPilesFixture rotation={rotation} light={light} />,
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
    test(`autumn leaf piles ${light}`, async ({ mount, page }) => {
        const fixture = await mount(
            <AutumnLeafPilesFixture rotation={0} light={light} />,
        );
        await checkClusters(fixture, page, 0, light);
        if (light === 'rain' || light === 'snow') {
            await fixture.screenshot({
                path: `../../docs/autumn-leaf-piles-2026/${light}.png`,
            });
        } else {
            await expect(fixture).toHaveScreenshot(`${light}.png`);
        }
    });
}
test('autumn leaf piles small low-quality canvas', async ({ mount, page }) => {
    const fixture = await mount(
        <AutumnLeafPilesFixture rotation={0} light="cloudy" small />,
    );
    await checkClusters(fixture, page, 0);
    await expect(fixture).toHaveScreenshot('small.png');
});

for (const date of ['2026-03-21', '2026-07-15', '2026-11-20', '2027-01-15']) {
    test(`owned leaf piles persist visually in ${date}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnLeafPilesFixture
                rotation={1}
                date={date}
                light={date.includes('01-15') ? 'snow' : 'day'}
            />,
        );
        await checkClusters(fixture, page, 1);
        await expect(fixture).toHaveScreenshot(`season-${date}.png`, {
            maxDiffPixels: 20,
        });
    });
}
test('autumn leaf piles on raised supports', async ({ mount, page }) => {
    const fixture = await mount(<AutumnLeafPilesFixture rotation={3} raised />);
    await checkClusters(fixture, page, 3, '', true);
});
