import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { GardenStructureKitV1RendererFixture } from '../../../packages/game/tests/GardenStructureKitV1RendererFixture';

type RendererReadback = Readonly<{
    fallbackInstanceCount: number;
    fallbackMeshCount: number;
    materialNames: readonly string[];
    opaqueDrawCount: number;
    productionNodeNames: readonly string[];
    status: 'ready';
    target: Readonly<{ x: number; y: number }>;
    transparentDrawCount: number;
    unresolvedBatchCount: number;
}>;

async function readRendererResult(fixture: Locator) {
    return JSON.parse(
        (await fixture
            .getByTestId('garden-structure-kit-v1-renderer-result')
            .textContent()) ?? '{}',
    ) as RendererReadback;
}

function observeGardenStructureKitRequests(page: Page) {
    const requests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/GardenStructureKitV1.glb')) {
            requests.push(request.url());
        }
    });
    return requests;
}

test('renders and selects real multi-material kit nodes in separate passes', async ({
    mount,
    page,
}, testInfo) => {
    const browserErrors: string[] = [];
    const assetRequests = observeGardenStructureKitRequests(page);
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    const fixture = await mount(
        <GardenStructureKitV1RendererFixture mode="production" />,
    );
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const result = await readRendererResult(fixture);

    expect(result).toMatchObject({
        fallbackMeshCount: 0,
        opaqueDrawCount: 4,
        status: 'ready',
        transparentDrawCount: 1,
        unresolvedBatchCount: 0,
    });
    expect(result.productionNodeNames).toEqual([
        'GardenStructureKitV1_PropTable_Mesh',
        'GardenStructureKitV1_PropTable_Mesh_1',
        'GardenStructureKitV1_PropTable_Mesh_2',
        'GardenStructureKitV1_WallGreenhouseFrame',
        'GardenStructureKitV1_WallGreenhouseGlass',
    ]);
    expect(result.materialNames).toContain(
        'Material.GardenStructureKitV1.Glass',
    );
    expect(assetRequests).toHaveLength(1);

    await fixture.screenshot({
        path: testInfo.outputPath('garden-structure-kit-unselected.png'),
    });
    await fixture.locator('canvas').click({ position: result.target });
    await expect(
        fixture.getByTestId('garden-structure-kit-v1-selection'),
    ).toHaveText('fixture-table-instance');
    await fixture.screenshot({
        path: testInfo.outputPath('garden-structure-kit-production.png'),
    });
    expect(browserErrors).toEqual([]);
});

test('keeps a selectable semantic box when production geometry is unresolved', async ({
    mount,
    page,
}) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    const fixture = await mount(
        <GardenStructureKitV1RendererFixture mode="missing" />,
    );
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const result = await readRendererResult(fixture);

    expect(result).toMatchObject({
        fallbackMeshCount: 1,
        opaqueDrawCount: 0,
        productionNodeNames: [],
        status: 'ready',
        transparentDrawCount: 0,
        unresolvedBatchCount: 1,
    });
    await fixture.locator('canvas').click({ position: result.target });
    await expect(
        fixture.getByTestId('garden-structure-kit-v1-selection'),
    ).toHaveText('fixture-fallback-instance');
    await expect(fixture.locator('canvas')).toBeVisible();
    expect(browserErrors).toEqual([]);
});

test('contains a failed GLB load and keeps the full semantic renderer interactive', async ({
    mount,
    page,
}) => {
    const assetRequests = observeGardenStructureKitRequests(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/GardenStructureKitV1.glb*', (route) =>
        route.fulfill({
            body: 'intentional renderer fixture failure',
            contentType: 'text/plain',
            status: 503,
        }),
    );

    const fixture = await mount(
        <GardenStructureKitV1RendererFixture mode="asset-error" />,
    );
    await expect(fixture).toHaveAttribute('data-renderer-ready', 'true');
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const result = await readRendererResult(fixture);

    expect(result).toMatchObject({
        fallbackMeshCount: 2,
        opaqueDrawCount: 0,
        productionNodeNames: [],
        status: 'ready',
        transparentDrawCount: 0,
        unresolvedBatchCount: 2,
    });
    await fixture.locator('canvas').click({ position: result.target });
    await expect(
        fixture.getByTestId('garden-structure-kit-v1-selection'),
    ).toHaveText('fixture-greenhouse-wall-instance');
    await expect(fixture.locator('canvas')).toBeVisible();
    expect(assetRequests).toHaveLength(1);
    expect(pageErrors).toHaveLength(1);
    expect(pageErrors[0]).toContain(
        'Could not load /assets/models/GardenStructureKitV1.glb',
    );
});

test('keeps an incompatible portal and hidden prop visible through a required footprint', async ({
    mount,
    page,
}) => {
    const assetRequests = observeGardenStructureKitRequests(page);
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    const fixture = await mount(
        <GardenStructureKitV1RendererFixture mode="incompatible-portal-prop" />,
    );
    await expect(fixture).toHaveAttribute('data-renderer-ready', 'true');
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const result = await readRendererResult(fixture);

    expect(result).toMatchObject({
        fallbackInstanceCount: 4,
        fallbackMeshCount: 1,
        opaqueDrawCount: 0,
        productionNodeNames: [],
        transparentDrawCount: 0,
        unresolvedBatchCount: 1,
    });
    await fixture.locator('canvas').click({ position: result.target });
    await expect(
        fixture.getByTestId('garden-structure-kit-v1-selection-structure'),
    ).toHaveText('fixture-incompatible-portal-prop');
    expect(assetRequests).toEqual([]);
    expect(browserErrors).toEqual([]);
});

test('isolates a missing portal footprint from a resolved portal peer', async ({
    mount,
    page,
}) => {
    const assetRequests = observeGardenStructureKitRequests(page);
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    const fixture = await mount(
        <GardenStructureKitV1RendererFixture mode="portal-missing-mixed" />,
    );
    await expect(fixture).toHaveAttribute('data-renderer-ready', 'true');
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const result = await readRendererResult(fixture);

    expect(result).toMatchObject({
        fallbackInstanceCount: 4,
        fallbackMeshCount: 1,
        unresolvedBatchCount: 1,
    });
    expect(result.opaqueDrawCount).toBeGreaterThan(0);
    expect(
        result.productionNodeNames.some((name) =>
            name.includes('DoorTimberWideOpen'),
        ),
    ).toBe(true);
    await fixture.locator('canvas').click({ position: result.target });
    await expect(
        fixture.getByTestId('garden-structure-kit-v1-selection-structure'),
    ).toHaveText('fixture-missing-portal');
    expect(assetRequests).toHaveLength(1);
    expect(browserErrors).toEqual([]);
});

test('uses a shallow portal footprint when the shared asset load fails', async ({
    mount,
    page,
}) => {
    const assetRequests = observeGardenStructureKitRequests(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/GardenStructureKitV1.glb*', (route) =>
        route.fulfill({
            body: 'intentional portal renderer fixture failure',
            contentType: 'text/plain',
            status: 503,
        }),
    );

    const fixture = await mount(
        <GardenStructureKitV1RendererFixture mode="portal-asset-error" />,
    );
    await expect(fixture).toHaveAttribute('data-renderer-ready', 'true');
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const result = await readRendererResult(fixture);

    expect(result).toMatchObject({
        fallbackInstanceCount: 5,
        fallbackMeshCount: 2,
        opaqueDrawCount: 0,
        productionNodeNames: [],
        transparentDrawCount: 0,
        unresolvedBatchCount: 2,
    });
    await fixture.locator('canvas').click({ position: result.target });
    await expect(
        fixture.getByTestId('garden-structure-kit-v1-selection-structure'),
    ).toHaveText('fixture-error-portal');
    expect(assetRequests).toHaveLength(1);
    expect(pageErrors).toHaveLength(1);
    expect(pageErrors[0]).toContain(
        'Could not load /assets/models/GardenStructureKitV1.glb',
    );
});

test('does not request the lazy kit when no structure plan is mounted', async ({
    mount,
    page,
}) => {
    const assetRequests = observeGardenStructureKitRequests(page);
    const fixture = await mount(
        <GardenStructureKitV1RendererFixture mode="empty" />,
    );

    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    await page.waitForTimeout(250);
    expect(assetRequests).toEqual([]);
});
