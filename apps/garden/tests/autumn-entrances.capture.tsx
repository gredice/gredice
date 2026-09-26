import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { AutumnEntrancesFixture } from '../../../packages/game/tests/AutumnEntrancesFixture';

type SceneData = {
    cropMeshes: number;
    gateAngle: number;
    gateVariant: number;
    storageKey: string;
    clusters: {
        id: string;
        rotation: number;
        minY: number;
        height: number;
        width: number;
        depth: number;
        triangles: number;
        materials: number;
        snow: number;
        rain: number;
        decorHits: number;
        x: number;
        y: number;
    }[];
};
async function readScene(fixture: Locator): Promise<SceneData> {
    return JSON.parse((await fixture.getAttribute('data-ready')) ?? '{}');
}
async function checkScene(
    fixture: Locator,
    page: Page,
    rotation: number,
    weather = '',
    raised = false,
    open = false,
) {
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    await expect
        .poll(async () => (await readScene(fixture)).gateAngle)
        .toBeCloseTo(open ? -Math.PI / 2 : 0, 4);
    const data = await readScene(fixture);
    expect(data.cropMeshes).toBeGreaterThan(0);
    expect(data.clusters).toHaveLength(3);
    for (const item of data.clusters) {
        expect(item.triangles).toBe(
            item.id === 'wreath' ? 920 : item.id === 'garland' ? 696 : 1972,
        );
        expect(item.materials).toBe(item.id === 'gate' ? 3 : 2);
        expect(item.rotation).toBeCloseTo((rotation * Math.PI) / 2, 5);
        expect(item.minY).toBeCloseTo(raised ? 1.07 : 0.4, 3);
        expect(item.height).toBeGreaterThan(
            item.id === 'wreath' ? 1.01 : item.id === 'garland' ? 0.89 : 0.73,
        );
        expect(item.height).toBeLessThanOrEqual(
            item.id === 'wreath' ? 1.05 : item.id === 'garland' ? 0.95 : 0.8,
        );
        expect(item.width).toBeLessThanOrEqual(
            item.id === 'gate' ? (open ? 1.3 : 1.05) : 0.9,
        );
        expect(item.depth).toBeLessThanOrEqual(
            item.id === 'gate' ? (open ? 1.3 : 1.05) : 0.9,
        );
        expect(item.decorHits).toBe(0);
        if (weather === 'rain') expect(item.rain).toBeGreaterThan(0);
        if (weather === 'snow') expect(item.snow).toBeGreaterThan(0);
        if (item.id !== 'gate') {
            await fixture
                .locator('canvas')
                .click({ position: { x: item.x, y: item.y } });
            await expect(fixture).toHaveAttribute('data-hit', item.id);
        }
    }
    await page.getByRole('button', { name: 'Pregledaj rajčicu' }).click();
    await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
}
const writes = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
    const requests: string[] = [];
    writes.set(page, requests);
    page.on('pageerror', (e) => console.error(e.stack));
    await page.route('**/*', (route) => {
        const r = route.request();
        const u = new URL(r.url());
        if (!['GET', 'HEAD'].includes(r.method()))
            requests.push(`${r.method()} ${u.pathname}`);
        return !['localhost', '127.0.0.1'].includes(u.hostname) ||
            !['GET', 'HEAD'].includes(r.method())
            ? route.abort()
            : route.continue();
    });
});
test.afterEach(async ({ page }) => {
    expect(writes.get(page)).toEqual([]);
});
for (const light of ['day', 'night'] satisfies ('day' | 'night')[])
    for (const rotation of [0, 1, 2, 3])
        test(`autumn entrances ${light} ${rotation}`, async ({
            mount,
            page,
        }) => {
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            const f = await mount(
                <AutumnEntrancesFixture rotation={rotation} light={light} />,
            );
            await checkScene(f, page, rotation);
            await expect(f).toHaveScreenshot(`${light}-${rotation}.png`, {
                maxDiffPixels: light === 'night' ? 20 : 0,
            });
            expect(errors).toEqual([]);
        });
for (const light of ['cloudy', 'dusk', 'rain', 'snow'] satisfies (
    | 'cloudy'
    | 'dusk'
    | 'rain'
    | 'snow'
)[])
    test(`autumn entrances ${light}`, async ({ mount, page }) => {
        const f = await mount(
            <AutumnEntrancesFixture rotation={0} light={light} />,
        );
        await checkScene(f, page, 0, light);
        if (light === 'rain' || light === 'snow')
            await f.screenshot({
                path: `../../docs/autumn-entrances-2026/${light}.png`,
            });
        else await expect(f).toHaveScreenshot(`${light}.png`);
    });
test('autumn entrances small low-quality canvas', async ({ mount, page }) => {
    const f = await mount(
        <AutumnEntrancesFixture rotation={0} light="cloudy" small />,
    );
    await checkScene(f, page, 0);
    await expect(f).toHaveScreenshot('small.png');
});
for (const rotation of [0, 1, 2, 3]) {
    test(`autumn entrances raised supports ${rotation}`, async ({
        mount,
        page,
    }) => {
        const f = await mount(
            <AutumnEntrancesFixture rotation={rotation} raised />,
        );
        await checkScene(f, page, rotation, '', true);
    });
    test(`autumn entrances open gate ${rotation}`, async ({ mount, page }) => {
        const f = await mount(
            <AutumnEntrancesFixture rotation={rotation} gateOpen />,
        );
        await checkScene(f, page, rotation, '', false, true);
        await expect(f).toHaveScreenshot(`open-${rotation}.png`);
    });
}
test('autumn entrances gate toggles and retains its state after sandbox reload', async ({
    mount,
}) => {
    let f = await mount(<AutumnEntrancesFixture rotation={0} />);
    await expect(f).toHaveAttribute('data-ready', /.+/);
    const clickGate = async () => {
        const gate = (await readScene(f)).clusters.find((i) => i.id === 'gate');
        expect(gate).toBeDefined();
        if (gate)
            await f
                .locator('canvas')
                .click({ position: { x: gate.x, y: gate.y } });
    };
    await clickGate();
    await expect.poll(async () => (await readScene(f)).gateVariant).toBe(1);
    await expect
        .poll(async () => (await readScene(f)).gateAngle)
        .toBeCloseTo(-Math.PI / 2, 4);
    await f.unmount();
    f = await mount(<AutumnEntrancesFixture rotation={0} />);
    await expect(f).toHaveAttribute('data-ready', /.+/);
    await expect
        .poll(async () => (await readScene(f)).gateAngle)
        .toBeCloseTo(-Math.PI / 2, 4);
    await clickGate();
    await expect.poll(async () => (await readScene(f)).gateVariant).toBe(0);
    await expect
        .poll(async () => (await readScene(f)).gateAngle)
        .toBeCloseTo(0, 4);
});
