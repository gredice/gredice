import type { GardenPackGroupPlacementBody } from '@gredice/client';
import { resolveGardenPackLayoutPlacements } from '@gredice/js/gardenPackLayouts';
import { expect, test } from '@playwright/experimental-ct-react';
import {
    createPackLayoutFixtureGarden,
    createPackLayoutFixtureLayout,
    packLayoutFixtureAccountId,
    packLayoutFixturePurchaseId,
} from '../../../packages/game/tests/ownedPackLayoutFixture';
import { PackLayoutPreviewFixture } from '../../../packages/game/tests/PackLayoutPreviewFixture';

test.use({ hasTouch: true });
test.setTimeout(90000);
async function sample(page: import('@playwright/test').Page) {
    return JSON.parse(
        (await page.getByTestId('layout-report').textContent()) || '{}',
    );
}
async function source(page: import('@playwright/test').Page, missing = false) {
    await page.route('**/api/gardens/942', async (route) => {
        const garden = createPackLayoutFixtureGarden();
        const stacks: Record<
            string,
            Record<string, (typeof garden.stacks)[number]['blocks']>
        > = {};
        for (const stack of garden.stacks) {
            const x = stack.position.x.toString();
            stacks[x] ??= {};
            stacks[x][stack.position.z.toString()] = stack.blocks;
        }
        await route.fulfill({
            json: { ...garden, latitude: 45.8, longitude: 16, stacks },
        });
    });
    await page.route('**/garden-packs/*/layouts', async (route) => {
        const layout = createPackLayoutFixtureLayout();
        if (missing) layout.availableUnits = [];
        await route.fulfill({
            json: {
                enabled: true,
                accountId: packLayoutFixtureAccountId,
                purchaseId: packLayoutFixturePurchaseId,
                layouts: [layout],
            },
        });
    });
}
async function assertFramed(page: import('@playwright/test').Page) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
        .poll(
            async () => {
                const points = (await sample(page)).projected;
                const hud = await page
                    .getByRole('region', {
                        name: 'Pregled rasporeda iz paketa',
                    })
                    .boundingBox();
                const canvas = await page.locator('canvas').boundingBox();
                return (
                    points?.length === 8 &&
                    hud &&
                    canvas &&
                    points.every(
                        ([x, y]: number[]) =>
                            x >= canvas.x + 10 &&
                            x <= canvas.x + canvas.width - 10 &&
                            y >= Math.max(0, canvas.y) + 10 &&
                            y <= Math.min(canvas.y + canvas.height, hud.y) - 10,
                    )
                );
            },
            { timeout: 30000 },
        )
        .toBe(true);
}
async function start(page: import('@playwright/test').Page) {
    await page.locator('[data-owned-pack]').locator('summary').click();
    await page
        .getByRole('button', { name: 'Postavi kao na slici', exact: true })
        .click();
    await expect(
        page.getByRole('region', { name: 'Pregled rasporeda iz paketa' }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
        .poll(async () => (await sample(page)).ghosts, { timeout: 30000 })
        .toBe(4);
}

test('real translucent complete preview rotates all four ways, moves by keyboard/touch and cancels without writes', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 650 });
    await source(page);
    const writes: string[] = [];
    page.on('request', (request) => {
        if (request.method() !== 'GET') writes.push(request.url());
    });
    await mount(<PackLayoutPreviewFixture />);
    const original = await page.getByTestId('layout-garden').textContent();
    await expect
        .poll(async () => Boolean((await sample(page)).camera))
        .toBe(true);
    const originalCamera = (await sample(page)).camera;
    await start(page);
    const region = page.getByRole('region', {
        name: 'Pregled rasporeda iz paketa',
    });
    await expect(
        page.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeEnabled({ timeout: 30000 });
    expect((await sample(page)).cells).toBe(5);
    expect(
        (await sample(page)).cellHeights.every(
            (height: number) => height > 0.4,
        ),
    ).toBe(true);
    expect((await sample(page)).cellColors).toEqual(Array(5).fill('4ade80'));
    await assertFramed(page);
    await page
        .locator('canvas')
        .screenshot({ path: '/tmp/gredice-owned-layout-preview-mobile-0.png' });
    await page.screenshot({
        path: '/tmp/gredice-owned-layout-preview-mobile-0-full.png',
    });
    expect((await sample(page)).opaque).toBe(0);
    expect((await sample(page)).lights).toBe(0);
    expect((await sample(page)).steam).toBe(0);
    await expect(region).toContainText('Već plaćeno');
    await expect(region).not.toContainText('FallenLog');
    for (const rotation of [1, 2, 3, 0]) {
        await page
            .getByRole('button', { name: 'Zakreni 90°', exact: true })
            .tap();
        await expect
            .poll(async () => (await sample(page)).rotation)
            .toBe(rotation);
        await expect.poll(async () => (await sample(page)).cells).toBe(5);
        await assertFramed(page);
        if (rotation === 1)
            await page.screenshot({
                path: '/tmp/gredice-owned-layout-preview-mobile-90.png',
            });
        await expect(
            page.getByRole('button', { name: 'Potvrdi postavljanje' }),
        ).toBeEnabled();
    }
    await region.locator('summary').click();
    await assertFramed(page);
    await page.screenshot({
        path: '/tmp/gredice-owned-layout-preview-mobile-expanded.png',
    });
    await region.locator('summary').click();
    await assertFramed(page);
    await region.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await sample(page)).anchor?.x).toBe(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    const normalized = (await sample(page)).normalized;
    const canvas = await page.locator('canvas').boundingBox();
    expect(canvas).not.toBeNull();
    if (!canvas) throw new Error('Canvas unavailable');
    const point = {
        x: canvas.x + canvas.width * normalized.x,
        y: canvas.y + canvas.height * normalized.y,
    };
    expect(
        await page.evaluate(
            (p) => document.elementFromPoint(p.x, p.y)?.tagName,
            point,
        ),
    ).toBe('CANVAS');
    await page.touchscreen.tap(point.x, point.y);
    await expect.poll(async () => (await sample(page)).anchor?.y).toBe(3);
    await region.focus();
    await page.keyboard.press('Escape');
    await expect(region).toHaveCount(0);
    await expect.poll(async () => (await sample(page)).exists).toBe(false);
    expect(await page.getByTestId('layout-garden').textContent()).toBe(
        original,
    );
    await expect
        .poll(async () => (await sample(page)).camera)
        .toEqual(originalCamera);
    expect(writes).toEqual([]);
});

test('collision, missing quantities and stale garden retain full red preview and never submit', async ({
    mount,
    page,
}) => {
    await source(page);
    const commands: string[] = [];
    page.on('request', (request) => {
        if (request.method() === 'POST') commands.push(request.url());
    });
    let component = await mount(<PackLayoutPreviewFixture collision />);
    await start(page);
    await expect(
        page.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeDisabled();
    expect((await sample(page)).ghosts).toBe(4);
    expect((await sample(page)).valid).toBe(false);
    await assertFramed(page);
    expect((await sample(page)).cellColors).toEqual(Array(5).fill('ef4444'));
    expect(
        (await sample(page)).cellHeights.every(
            (height: number) => height > 0.4,
        ),
    ).toBe(true);
    await page.getByRole('button', { name: 'Pomakni lijevo' }).click();
    await page.getByRole('button', { name: 'Pomakni lijevo' }).click();
    await page.getByRole('button', { name: 'Pomakni lijevo' }).click();
    await expect(
        page.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Promijeni vrt' }).click();
    await expect(page.getByRole('region')).toContainText('Vrt se promijenio');
    await expect(
        page.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeDisabled();
    await component.unmount();
    await source(page, true);
    component = await mount(<PackLayoutPreviewFixture missing />);
    await start(page);
    await expect(page.getByRole('region')).toContainText('0 dostupno');
    await expect(
        page.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeDisabled();
    expect((await sample(page)).ghosts).toBe(4);
    expect(commands).toEqual([]);
});

test('lost group response survives remount as an exact owner-bound retry without another debit or unit command', async ({
    mount,
    page,
}) => {
    await source(page);
    const commands: GardenPackGroupPlacementBody[] = [];
    await page.route('**/garden-packs/*/layouts/*/place', async (route) => {
        const input: GardenPackGroupPlacementBody = route
            .request()
            .postDataJSON();
        commands.push(input);
        if (commands.length === 1) {
            await route.abort('failed');
            return;
        }
        const layout = createPackLayoutFixtureLayout();
        await route.fulfill({
            json: {
                operationId: input.operationId,
                purchaseId: packLayoutFixturePurchaseId,
                gardenId: 942,
                layoutId: layout.id,
                layoutVersionId: layout.versionId,
                chargedSunflowers: 0,
                replayed: true,
                placements: input.units.map((unit, index) => ({
                    ...unit,
                    blockId: `50000000-0000-4000-8000-00000000001${index}`,
                    modelName: layout.placements[index]?.modelName,
                    rotation: resolveGardenPackLayoutPlacements(
                        layout,
                        input.anchor,
                        input.rotation,
                    )[index]?.rotation,
                    variant: null,
                    position: resolveGardenPackLayoutPlacements(
                        layout,
                        input.anchor,
                        input.rotation,
                    )[index]?.position,
                    existingBlocks: [],
                })),
            },
        });
    });
    let component = await mount(<PackLayoutPreviewFixture />);
    await expect
        .poll(async () => Boolean((await sample(page)).camera))
        .toBe(true);
    const originalCamera = (await sample(page)).camera;
    await start(page);
    await page.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Promijeni račun' }).click();
    await expect(page.getByRole('region')).toHaveCount(0);
    await expect.poll(async () => (await sample(page)).active).toBe(false);
    await expect
        .poll(async () => (await sample(page)).camera)
        .toEqual(originalCamera);
    await page.getByRole('button', { name: 'Vrati račun' }).click();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toBeVisible();
    expect(commands).toHaveLength(1);
    await component.unmount();
    component = await mount(<PackLayoutPreviewFixture />);
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toBeVisible();
    await expect.poll(async () => (await sample(page)).active).toBe(true);
    await page.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();
    await expect(page.getByRole('region')).toContainText(
        'Postavljeno 4 predmeta',
    );
    await expect
        .poll(async () => (await sample(page)).camera)
        .toEqual(originalCamera);
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual(commands[0]);
    expect(commands[0]?.expectedAccountId).toBe(packLayoutFixtureAccountId);
    await page.getByRole('button', { name: 'Zatvori', exact: true }).click();
    await expect(page.getByRole('region')).toHaveCount(0);
    await page.getByRole('button', { name: 'Otvori paket' }).click();
    await start(page);
    await page.getByRole('button', { name: 'Promijeni račun' }).click();
    await expect(page.getByRole('region')).toHaveCount(0);
    expect(commands).toHaveLength(2);
});

test('definitive rejection clears the old command; fresh review uses a new operation and unavailable sources cannot open a preview', async ({
    mount,
    page,
}) => {
    await source(page);
    const commands: GardenPackGroupPlacementBody[] = [];
    await page.route('**/garden-packs/*/layouts/*/place', async (route) => {
        commands.push(route.request().postDataJSON());
        await route.fulfill({
            status: 409,
            json: { error: 'Stale stacks', code: 'GROUP_PLACEMENT_STALE' },
        });
    });
    let component = await mount(<PackLayoutPreviewFixture />);
    await start(page);
    await page.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expect(page.getByRole('alert')).toContainText(
        'Raspored nije postavljen',
    );
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toHaveCount(0);
    expect(
        await page.evaluate(() =>
            Object.keys(sessionStorage).filter((key) =>
                key.startsWith('gredice:pending-pack-layout:'),
            ),
        ),
    ).toEqual([]);
    await expect(page.getByRole('button', { name: 'Potvrdi postavljanje' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Zatvori', exact: true }).click();
    await page.getByRole('button', { name: 'Otvori paket' }).click();
    await start(page);
    await page.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expect.poll(() => commands.length).toBe(2);
    expect(commands[1]?.operationId).not.toBe(commands[0]?.operationId);
    await component.unmount();
    component = await mount(<PackLayoutPreviewFixture unavailable />);
    await page.locator('[data-owned-pack]').locator('summary').click();
    await expect(
        page.getByRole('button', { name: 'Postavi kao na slici', exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole('region')).toHaveCount(0);
    expect(commands).toHaveLength(2);
});
