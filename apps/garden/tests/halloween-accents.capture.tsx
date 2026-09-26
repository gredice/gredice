import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { HalloweenAccentsFixture } from '../../../packages/game/tests/HalloweenAccentsFixture';

async function checkAccents(
    fixture: Locator,
    page: Page,
    rotation: number,
    weather = '',
    raised = false,
) {
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    const data: {
        cropMeshes: number;
        batMeshes: number;
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
    if (weather === 'night') expect(data.batMeshes).toBeGreaterThan(0);
    expect(data.clusters).toHaveLength(2);
    expect(new Set(data.clusters.map((item) => item.materialId)).size).toBe(2);
    for (const item of data.clusters) {
        expect(item.triangles).toBe(item.id === 'ghost' ? 468 : 596);
        expect(item.rotation).toBeCloseTo((rotation * Math.PI) / 2, 5);
        expect(item.minY).toBeCloseTo(raised ? 1.07 : 0.4, 3);
        expect(item.height).toBeGreaterThan(0.95);
        expect(item.height).toBeLessThanOrEqual(1);
        expect(item.width).toBeLessThanOrEqual(0.9);
        expect(item.depth).toBeLessThanOrEqual(0.9);
        expect(item.minX).toBeGreaterThanOrEqual(-2.45);
        expect(item.minZ).toBeGreaterThanOrEqual(-1.45);
        expect(item.maxX).toBeLessThanOrEqual(-1.55);
        expect(item.maxZ).toBeLessThanOrEqual(
            item.id === 'ghost' ? -0.55 : 0.45,
        );
        if (weather === 'rain') expect(item.rain).toBeGreaterThan(0);
        if (weather === 'snow') expect(item.snow).toBeGreaterThan(0);
        await fixture
            .locator('canvas')
            .click({ position: { x: item.x, y: item.y } });
        await expect(fixture).toHaveAttribute('data-hit', item.id, {
            timeout: 5000,
        });
    }
    for (const neighbor of data.neighbors) {
        await fixture
            .locator('canvas')
            .click({ position: { x: neighbor.x, y: neighbor.y } });
        await expect(fixture).toHaveAttribute('data-hit', neighbor.id, {
            timeout: 5000,
        });
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
        test(`halloween accents ${light} ${rotation}`, async ({
            mount,
            page,
        }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const fixture = await mount(
                <HalloweenAccentsFixture rotation={rotation} light={light} />,
            );
            await checkAccents(fixture, page, rotation, light);
            if (light === 'night') {
                await fixture.screenshot({
                    path: `../../docs/halloween-accents-2026/${light}-${rotation}.png`,
                });
            } else
                await expect(fixture).toHaveScreenshot(
                    `${light}-${rotation}.png`,
                );
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
    test(`halloween accents ${light}`, async ({ mount, page }) => {
        const fixture = await mount(
            <HalloweenAccentsFixture rotation={0} light={light} />,
        );
        await checkAccents(fixture, page, 0, light);
        if (light === 'rain' || light === 'snow' || light === 'dusk') {
            await fixture.screenshot({
                path: `../../docs/halloween-accents-2026/${light}.png`,
            });
        } else {
            await expect(fixture).toHaveScreenshot(`${light}.png`);
        }
    });
}
test('halloween accents small low-quality canvas', async ({ mount, page }) => {
    const fixture = await mount(
        <HalloweenAccentsFixture rotation={0} light="cloudy" small />,
    );
    await checkAccents(fixture, page, 0);
    await expect(fixture).toHaveScreenshot('small.png');
});

for (const rotation of [0, 1, 2, 3]) {
    test(`halloween accents raised supports ${rotation}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <HalloweenAccentsFixture rotation={rotation} raised />,
        );
        await checkAccents(fixture, page, rotation, '', true);
    });
}

test('halloween accents remain usable after the event ends', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <HalloweenAccentsFixture
            rotation={0}
            light="day"
            date="2027-01-20T12:00:00+01:00"
        />,
    );
    await checkAccents(fixture, page, 0, 'day');
});
