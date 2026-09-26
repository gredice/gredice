import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { PumpkinLanternsFixture } from '../../../packages/game/tests/PumpkinLanternsFixture';

async function checkLanterns(
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
            emission: number;
            lightShadow: boolean;
            x: number;
            y: number;
        }[];
    } = JSON.parse((await fixture.getAttribute('data-ready')) ?? '{}');
    expect(data.cropMeshes).toBeGreaterThan(0);
    expect(data.clusters).toHaveLength(2);
    expect(new Set(data.clusters.map((item) => item.materialId)).size).toBe(2);
    for (const item of data.clusters) {
        expect(item.triangles).toBe(item.id === 'smile' ? 1560 : 1578);
        expect(item.rotation).toBeCloseTo((rotation * Math.PI) / 2, 5);
        expect(item.minY).toBeCloseTo(raised ? 1.07 : 0.4, 3);
        expect(item.height).toBeGreaterThan(0.54);
        expect(item.height).toBeLessThanOrEqual(0.55);
        expect(item.width).toBeLessThanOrEqual(0.9);
        expect(item.depth).toBeLessThanOrEqual(0.9);
        expect(item.minX).toBeGreaterThanOrEqual(-2.45);
        expect(item.minZ).toBeGreaterThanOrEqual(-1.45);
        expect(item.maxX).toBeLessThanOrEqual(-1.55);
        expect(item.maxZ).toBeLessThanOrEqual(
            item.id === 'smile' ? -0.55 : 0.45,
        );
        expect(item.lightShadow).toBe(false);
        if (weather === 'night') expect(item.emission).toBeGreaterThan(0.1);
        if (weather === 'day') expect(item.emission).toBeCloseTo(0.025, 5);
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
        test(`pumpkin lanterns ${light} ${rotation}`, async ({
            mount,
            page,
        }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const fixture = await mount(
                <PumpkinLanternsFixture rotation={rotation} light={light} />,
            );
            await checkLanterns(fixture, page, rotation, light);
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
    test(`pumpkin lanterns ${light}`, async ({ mount, page }) => {
        const fixture = await mount(
            <PumpkinLanternsFixture rotation={0} light={light} />,
        );
        await checkLanterns(fixture, page, 0, light);
        if (light === 'rain' || light === 'snow') {
            await fixture.screenshot({
                path: `../../docs/pumpkin-lanterns-2026/${light}.png`,
            });
        } else {
            await expect(fixture).toHaveScreenshot(`${light}.png`);
        }
    });
}
test('pumpkin lanterns small low-quality canvas', async ({ mount, page }) => {
    const fixture = await mount(
        <PumpkinLanternsFixture rotation={0} light="cloudy" small />,
    );
    await checkLanterns(fixture, page, 0);
    await expect(fixture).toHaveScreenshot('small.png');
});

for (const rotation of [0, 1, 2, 3]) {
    test(`pumpkin lanterns raised supports ${rotation}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <PumpkinLanternsFixture rotation={rotation} raised />,
        );
        await checkLanterns(fixture, page, rotation, '', true);
    });
}

for (const small of [false, true])
    test(`pumpkin lanterns shared light cap ${small ? 'low' : 'high'}`, async ({
        mount,
    }) => {
        const fixture = await mount(
            <PumpkinLanternsFixture
                rotation={0}
                light="night"
                dense
                small={small}
            />,
        );
        await expect(fixture).toHaveAttribute('data-ready', /.+/);
        const report = JSON.parse(
            (await fixture.getAttribute('data-ready')) ?? '{}',
        );
        expect(report.lights).toBe(39);
        expect(report.activeLights).toBeGreaterThan(0);
        expect(report.activeLights).toBeLessThanOrEqual(small ? 4 : 20);
        expect(report.shadowLights).toBe(0);
        console.log(
            'Pumpkin lantern scene',
            small ? 'low' : 'high',
            JSON.stringify({
                lights: report.lights,
                active: report.activeLights,
            }),
        );
    });

test('pumpkin lanterns remain usable after the event ends', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <PumpkinLanternsFixture
            rotation={0}
            light="night"
            date="2027-01-20T22:30:00+01:00"
        />,
    );
    await checkLanterns(fixture, page, 0, 'night');
});
