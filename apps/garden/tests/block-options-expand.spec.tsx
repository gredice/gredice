import {
    type GardenBlockBatchPurchaseBody,
    parseGardenBlockBatchPurchaseBody,
} from '@gredice/client';
import {
    expect as baseExpect,
    type ComponentFixtures,
    test,
} from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { BlockOptionsFixture } from '../../../packages/game/tests/BlockOptionsFixture';
import {
    blockOptionsFixtureBlockIds,
    blockOptionsFixtureGroundId,
    blockOptionsFixtureNightTime,
    blockOptionsFixtureStageSizes,
    createBlockOptionsFixtureBlockData,
    createBlockOptionsFixtureGarden,
    createBlockOptionsFixtureStacks,
} from '../../../packages/game/tests/blockOptionsFixtureData';
import {
    type BlockOptionsRecordedWrite,
    collectPageErrors,
    installBlockOptionsBackend,
    readBlockOptionsProbe,
    waitForBlockOptionsFixture,
} from './blockOptionsTestSupport';

// Expand bar, batch request and recovery (spec §14.3 #25–#31). The fixture
// opens Expand through the probe (as Proširi does) and moves the corner
// (as the handle does); every write is stubbed and recorded.

test.setTimeout(120_000);
// Several WebGL fixtures share the CPU in parallel runs; a probe read can
// take seconds there, so assertions wait longer than the default 5 s.
const expect = baseExpect.configure({ timeout: 15_000 });

const batchPath = /\/api\/gardens\/951\/blocks\/batch$/;
const pendingKey = 'gredice:pending-block-expand:["block-options-user",951]';
/** Grass at the edge of the fixture's 3 × 2 hole (x 2–4, z −4…−3). */
const terrainSourceId = blockOptionsFixtureGroundId(1, -4);
const terrainCorner = { x: 4, z: -3 };
/**
 * The plan for 1,−4 → 4,−3: six empty cells by distance from the source,
 * then z, then x; the grass at 1,−3 is skipped (occupied).
 */
const terrainPlacements = [
    { x: 2, y: -4 },
    { x: 2, y: -3 },
    { x: 3, y: -4 },
    { x: 3, y: -3 },
    { x: 4, y: -4 },
    { x: 4, y: -3 },
];

function region(page: Page) {
    return page.getByRole('region', { name: 'Proširivanje bloka' });
}

/**
 * The live region that announces receipts: it stays mounted while the bar
 * above it is replaced, so screen readers read the receipt.
 */
function announcer(page: Page) {
    return page.locator('[data-block-expand-announcer]');
}

/** The receipt is in the bar and announced by the live region. */
async function expectReceipt(page: Page, bar: Locator, text: string) {
    await expect(announcer(page)).toHaveAttribute('role', 'status');
    await expect(announcer(page)).toHaveText(text);
    await expect(bar).toContainText(text);
}

function readEditing(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.blockEditing ?? null,
    );
}

/** Whether the open Expand is locked (pending); null when none is open. */
async function readExpandPending(page: Page) {
    const editing = await readEditing(page);
    return editing?.mode === 'expand' ? editing.pending : null;
}

async function startExpand(
    page: Page,
    blockId: string,
    corner: { x: number; z: number },
) {
    const started = await page.evaluate(
        (id) => window.__blockOptionsProbe?.startBlockExpand(id) ?? null,
        blockId,
    );
    expect(started).toEqual({ ok: true });
    await page.evaluate(
        ({ x, z }) => window.__blockOptionsProbe?.setBlockExpandCorner(x, z),
        corner,
    );
    await expect
        .poll(async () => (await readEditing(page))?.mode)
        .toBe('expand');
}

function batchBody(write: BlockOptionsRecordedWrite | undefined) {
    const body = parseGardenBlockBatchPurchaseBody(write?.body);
    if (!body) {
        throw new Error(`Not a batch body: ${JSON.stringify(write?.body)}`);
    }
    return body;
}

function batchReceipt(
    body: GardenBlockBatchPurchaseBody,
    { replayed = false }: { replayed?: boolean } = {},
) {
    return {
        operationId: body.operationId,
        blockName: body.blockName,
        rotation: body.rotation,
        unitPrice: body.expectedUnitPrice,
        chargedSunflowers: body.expectedUnitPrice * body.placements.length,
        placements: body.placements.map((placement, index) => ({
            id: `saved-${body.blockName}-${index}`,
            position: placement.position,
        })),
        replayed,
    };
}

/** The fixture garden with the receipt's blocks placed (the refetch). */
function gardenAfter(
    body: GardenBlockBatchPurchaseBody,
    options: { sandbox?: boolean } = {},
) {
    const stacks = createBlockOptionsFixtureStacks();
    const receipt = batchReceipt(body);
    for (const placement of receipt.placements) {
        const block = {
            id: placement.id,
            name: body.blockName,
            rotation: body.rotation ?? 0,
        };
        const stack = stacks.find(
            (item) =>
                item.position.x === placement.position.x &&
                item.position.z === placement.position.y,
        );
        if (stack) {
            stack.blocks.push(block);
        } else {
            stacks.push({
                position: {
                    x: placement.position.x,
                    y: 0,
                    z: placement.position.y,
                },
                blocks: [block],
            });
        }
    }
    return createBlockOptionsFixtureGarden({ ...options, stacks });
}

function gardenBlocks(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.garden?.blocks ?? [],
    );
}

function readPendingCommand(page: Page) {
    return page.evaluate((key) => sessionStorage.getItem(key), pendingKey);
}

/** A promise the stubbed POST waits on, released by the test. */
function createGate() {
    let release: () => void = () => undefined;
    const opened = new Promise<void>((resolve) => {
        release = resolve;
    });
    return { opened, release };
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.clear());
});

test('#25 confirms terrain with one batch, keeps the plan frozen while pending and swaps the ids', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const gate = createGate();
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: async (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            const body = batchBody(write);
            await gate.opened;
            return { json: batchReceipt(body) };
        },
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });

    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await expect(bar).toContainText('Proširi: Block Grass');
    await expect(bar).toContainText('Područje 4 × 2 · Preskočena polja: 1');
    await expect(bar).toContainText('6 novih blokova');
    await expect(bar.locator('[data-block-expand-total]')).toHaveAttribute(
        'data-block-expand-total',
        '60',
    );
    // The HUD figure (balance minus cart), as the sunflower HUD shows it.
    const balance = bar.locator('[data-block-expand-balance]');
    await expect(balance).toHaveAttribute('data-block-expand-balance', '1000');
    await expect(balance).toContainText('Imaš');
    await expect(balance).toContainText('1.000');
    const confirm = bar.getByRole('button', { name: 'Potvrdi postavljanje' });
    await expect(confirm).toBeEnabled();
    // Opening Expand from a pointer does not move focus (D16).
    expect(
        await page.evaluate(() => document.activeElement?.tagName ?? null),
    ).toBe('BODY');
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-editing.png'),
    });

    await confirm.click();
    // Pending: the confirmed plan stays on screen while the live plan
    // would now count the optimistic copies as pending.
    await expect(
        bar.getByRole('button', { name: 'Provjera postavljanja…' }),
    ).toBeDisabled();
    await expect(bar.getByRole('button', { name: 'Odustani' })).toBeDisabled();
    await expect(bar).toContainText('6 novih blokova');
    await expect(bar.locator('[data-block-expand-total]')).toHaveAttribute(
        'data-block-expand-total',
        '60',
    );
    await expect.poll(async () => await readExpandPending(page)).toBe(true);
    await expect
        .poll(async () =>
            (await gardenBlocks(page))
                .filter((block) =>
                    block.id.startsWith('optimistic-block:Block_Grass:'),
                )
                .map((block) => ({ x: block.x, z: block.z }))
                .sort((a, b) => a.z - b.z || a.x - b.x),
        )
        .toEqual(
            terrainPlacements
                .map(({ x, y }) => ({ x, z: y }))
                .sort((a, b) => a.z - b.z || a.x - b.x),
        );
    // The optimistic debit shows on the HUD stand-in at once.
    await expect(
        page.locator('[data-block-options-fixture-balance]'),
    ).toHaveAttribute('data-block-options-fixture-balance', '940');
    // The bar's balance line follows the HUD figure.
    await expect(bar.locator('[data-block-expand-balance]')).toHaveAttribute(
        'data-block-expand-balance',
        '940',
    );
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-pending.png'),
    });

    const batches = backend.writesTo(batchPath, 'POST');
    expect(batches).toHaveLength(1);
    const body = batchBody(batches[0]);
    expect(body).toMatchObject({
        blockName: 'Block_Grass',
        rotation: 0,
        expectedUnitPrice: 10,
    });
    expect(body.operationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(body.placements).toEqual(
        terrainPlacements.map((position) => ({
            position,
            expectedExistingBlocks: [],
        })),
    );
    // The command is stored before it is sent.
    expect(JSON.parse((await readPendingCommand(page)) ?? 'null')).toEqual({
        gardenId: 951,
        body,
    });

    backend.setGarden(gardenAfter(body));
    backend.setSunflowers(940);
    gate.release();

    await expectReceipt(page, bar, 'Postavljeno: 6 blokova.');
    await expect(bar).toContainText('Proširivanje: Block Grass');
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-receipt-shown.png'),
    });
    await expect(bar.locator('[data-block-expand-total]')).toHaveAttribute(
        'data-block-expand-total',
        '60',
    );
    await expect.poll(() => readEditing(page)).toBeNull();
    await expect
        .poll(async () =>
            (await gardenBlocks(page))
                .filter((block) => block.name === 'Block_Grass')
                .filter(
                    (block) =>
                        block.id.startsWith('saved-') ||
                        block.id.startsWith('optimistic-'),
                )
                .map((block) => block.id)
                .sort(),
        )
        .toEqual(
            terrainPlacements.map((_, index) => `saved-Block_Grass-${index}`),
        );
    expect(await readPendingCommand(page)).toBeNull();
    // The camera moves to the middle of the placed area.
    await expect
        .poll(async () => {
            const target = (await readBlockOptionsProbe(page))?.camera.target;
            return target
                ? Math.hypot(target[0] - 3, target[2] - -3.5) < 0.75
                : false;
        })
        .toBe(true);
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-receipt.png'),
    });

    // The receipt closes on its own.
    await expect(bar).toHaveCount(0, { timeout: 6000 });
    expect(backend.writesTo(batchPath)).toHaveLength(1);
    expect(backend.writes).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('#26 sends the source rotation as quarter turns', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) =>
            batchPath.test(write.path)
                ? { json: batchReceipt(batchBody(write)) }
                : undefined,
    });
    const stacks = createBlockOptionsFixtureStacks();
    for (const stack of stacks) {
        for (const block of stack.blocks) {
            if (block.id === blockOptionsFixtureBlockIds.bush) {
                block.rotation = 5;
            }
        }
    }
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture stacks={stacks} />);
    await waitForBlockOptionsFixture(page, {
        blockId: blockOptionsFixtureBlockIds.bush,
    });

    // Bush on grass at −2,0 → −1,0: one copy on the grass next to it.
    await startExpand(page, blockOptionsFixtureBlockIds.bush, { x: -1, z: 0 });
    const bar = region(page);
    await expect(bar).toContainText('1 novi blok');
    await expect(bar.locator('[data-block-expand-total]')).toHaveAttribute(
        'data-block-expand-total',
        '25',
    );
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expectReceipt(page, bar, 'Postavljeno: 1 blok.');

    const body = batchBody(backend.writesTo(batchPath, 'POST')[0]);
    expect(body.rotation).toBe(1);
    expect(body.placements).toEqual([
        {
            position: { x: -1, y: 0 },
            expectedExistingBlocks: [blockOptionsFixtureGroundId(-1, 0)],
        },
    ]);
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('#27 sandbox gardens send expectedUnitPrice 0 and show 🌻 0', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page, {
        garden: createBlockOptionsFixtureGarden({ sandbox: true }),
        respondToWrite: (write) =>
            batchPath.test(write.path)
                ? { json: batchReceipt(batchBody(write)) }
                : undefined,
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture sandbox />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });

    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await expect(bar).toContainText('6 novih blokova');
    await expect(bar.locator('[data-block-expand-total]')).toHaveAttribute(
        'data-block-expand-total',
        '0',
    );
    await expect(bar.locator('[data-block-expand-balance]')).toHaveCount(0);
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-sandbox.png'),
    });

    backend.setGarden(
        gardenAfter(
            {
                operationId: '00000000-0000-4000-8000-000000000000',
                blockName: 'Block_Grass',
                rotation: 0,
                expectedUnitPrice: 0,
                placements: terrainPlacements.map((position) => ({
                    position,
                    expectedExistingBlocks: [],
                })),
            },
            { sandbox: true },
        ),
    );
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expectReceipt(page, bar, 'Postavljeno: 6 blokova.');
    const body = batchBody(backend.writesTo(batchPath, 'POST')[0]);
    expect(body.expectedUnitPrice).toBe(0);
    expect(body.placements).toHaveLength(6);
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('#28 disables Potvrdi with how many the HUD balance covers, and for night-only blocks by day', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page, {
        cartSunflowers: 975,
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    // 1000 on the account, 975 held by the cart: the HUD shows 25, which
    // covers 2 of the 6 copies (10 each). The raw balance would cover all.
    let component = await mount(<BlockOptionsFixture cartSunflowers={975} />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await expect(bar.locator('[data-block-expand-balance]')).toHaveAttribute(
        'data-block-expand-balance',
        '25',
    );
    await expect(bar.getByRole('status')).toHaveText(
        'Nedovoljno suncokreta. Imaš dovoljno za 2 bloka.',
    );
    await expect(
        bar.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeDisabled();
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-short.png'),
    });

    // Shrinking the area to what the balance covers enables it.
    await page.evaluate(() =>
        window.__blockOptionsProbe?.setBlockExpandCorner(2, -3),
    );
    await expect(bar).toContainText('2 nova bloka');
    await expect(bar.getByRole('status')).toHaveText('');
    await expect(
        bar.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeEnabled();
    await component.unmount();

    // Night-only grass by day.
    const nightOnlyBlockData = createBlockOptionsFixtureBlockData({
        nightOnly: ['Block_Grass'],
    });
    component = await mount(
        <BlockOptionsFixture blockData={nightOnlyBlockData} />,
    );
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    await expect(region(page).getByRole('status')).toHaveText(
        'Dostupno samo noću.',
    );
    await expect(
        region(page).getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeDisabled();
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-night-only.png'),
    });
    await component.unmount();

    // The same block at night can be confirmed.
    await mount(
        <BlockOptionsFixture
            blockData={nightOnlyBlockData}
            time={blockOptionsFixtureNightTime}
        />,
    );
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    await expect(region(page).getByRole('status')).toHaveText('');
    await expect(
        region(page).getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeEnabled();

    expect(backend.writes).toEqual([]);
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('#29 a 409 rolls back and re-plans; a 429 shows the limit and clears the pending command', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    let answer: 'conflict' | 'rate-limited' = 'conflict';
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            return answer === 'conflict'
                ? {
                      status: 409,
                      json: {
                          code: 'GARDEN_STATE_CHANGED',
                          error: 'Garden state changed',
                          conflicts: [{ index: 0, reason: 'stack-changed' }],
                      },
                  }
                : {
                      status: 429,
                      headers: { 'Retry-After': '120' },
                      json: {
                          code: 'RATE_LIMITED',
                          error: 'Too many batches',
                          retryAfterSeconds: 120,
                      },
                  };
        },
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await expect(bar).toContainText('6 novih blokova');

    // Someone else filled 2,−4 meanwhile: the server says the garden
    // changed, and the refetch shows the new grass.
    const changedStacks = createBlockOptionsFixtureStacks();
    changedStacks.push({
        position: { x: 2, y: 0, z: -4 },
        blocks: [{ id: 'elsewhere-grass', name: 'Block_Grass', rotation: 0 }],
    });
    backend.setGarden(
        createBlockOptionsFixtureGarden({ stacks: changedStacks }),
    );
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();

    await expect(bar.getByRole('alert')).toHaveText(
        'Vrt se promijenio. Pregled je osvježen, provjeri broj blokova i potvrdi ponovno.',
    );
    await expect.poll(async () => await readExpandPending(page)).toBe(false);
    // Rolled back: no optimistic copy is left, the balance is restored and
    // the plan now skips the refetched cell.
    await expect
        .poll(async () =>
            (await gardenBlocks(page)).filter((block) =>
                block.id.startsWith('optimistic-'),
            ),
        )
        .toEqual([]);
    await expect(bar).toContainText('5 novih blokova');
    await expect(bar).toContainText('Preskočena polja: 2');
    await expect(
        page.locator('[data-block-options-fixture-balance]'),
    ).toHaveAttribute('data-block-options-fixture-balance', '1000');
    expect(await readPendingCommand(page)).toBeNull();
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-conflict.png'),
    });

    // A fresh confirm (new operation) hits the rate limit.
    answer = 'rate-limited';
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expect(bar.getByRole('alert')).toHaveText(
        'Previše proširivanja u kratkom vremenu. Pokušaj ponovno za nekoliko minuta.',
    );
    await expect.poll(async () => await readExpandPending(page)).toBe(false);
    expect(await readPendingCommand(page)).toBeNull();
    await expect(
        bar.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toHaveCount(0);
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-rate-limited.png'),
    });

    const batches = backend.writesTo(batchPath, 'POST');
    expect(batches).toHaveLength(2);
    expect(batchBody(batches[1]).operationId).not.toBe(
        batchBody(batches[0]).operationId,
    );
    expect(batchBody(batches[1]).placements).toHaveLength(5);
    // Moving the corner clears the old message.
    await page.evaluate(() =>
        window.__blockOptionsProbe?.setBlockExpandCorner(3, -3),
    );
    await expect(bar.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('#29b a changed price puts the server price in the bar and the next confirm', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            const body = batchBody(write);
            // The directory the client cached says 10; the server says 12.
            return body.expectedUnitPrice === 12
                ? { json: batchReceipt(body) }
                : {
                      status: 409,
                      json: {
                          code: 'PRICE_CHANGED',
                          error: 'Price changed',
                          unitPrice: 12,
                      },
                  };
        },
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    const total = bar.locator('[data-block-expand-total]');
    await expect(total).toHaveAttribute('data-block-expand-total', '60');

    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expect(bar.getByRole('alert')).toHaveText(
        'Cijena se promijenila. Provjeri novi iznos i potvrdi ponovno.',
    );
    // The bar shows the server's price at once; the directory is not
    // refetched (its HTTP cache could still hold the old price).
    await expect(total).toHaveAttribute('data-block-expand-total', '72');
    await expect(
        bar.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeEnabled();

    backend.setGarden(gardenAfter(batchBody(backend.writesTo(batchPath)[0])));
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expectReceipt(page, bar, 'Postavljeno: 6 blokova.');
    const bodies = backend
        .writesTo(batchPath, 'POST')
        .map((write) => batchBody(write).expectedUnitPrice);
    expect(bodies).toEqual([10, 12]);
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('#29c a keyboard confirm keeps focus in the bar, then on the receipt, which stays until closed', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const gate = createGate();
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: async (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            const body = batchBody(write);
            await gate.opened;
            return { json: batchReceipt(body) };
        },
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    const confirm = bar.getByRole('button', { name: 'Potvrdi postavljanje' });
    await expect(confirm).toBeEnabled();
    // Reach Potvrdi with the keyboard (Odustani, then Tab).
    await bar.getByRole('button', { name: 'Odustani' }).focus();
    await page.keyboard.press('Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Enter');

    // Pending: Potvrdi is disabled, focus stays on the bar, not the page.
    await expect(
        bar.getByRole('button', { name: 'Provjera postavljanja…' }),
    ).toBeDisabled();
    await expect(bar).toBeFocused();

    await expect.poll(() => backend.writesTo(batchPath, 'POST').length).toBe(1);
    backend.setGarden(
        gardenAfter(batchBody(backend.writesTo(batchPath, 'POST')[0])),
    );
    gate.release();
    await expectReceipt(page, bar, 'Postavljeno: 6 blokova.');
    // The receipt takes focus on Zatvori and stays past its 3 s.
    const close = bar.getByRole('button', { name: 'Zatvori' });
    await expect(close).toBeFocused();
    await page.waitForTimeout(3500);
    await expect(bar).toContainText('Postavljeno: 6 blokova.');
    await page.keyboard.press('Enter');
    await expect(bar).toHaveCount(0);
    await expect(announcer(page)).toHaveText('');

    expect(backend.writesTo(batchPath)).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('#30 a lost response keeps the command; the same request is sent again, also after a remount', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const rawBodies: string[] = [];
    let attempts = 0;
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            attempts += 1;
            if (attempts < 3) {
                return 'abort';
            }
            return { json: batchReceipt(batchBody(write), { replayed: true }) };
        },
    });
    // Records the exact bytes, then lets the harness answer.
    await page.route('**/api/**/blocks/batch', async (route) => {
        rawBodies.push(route.request().postData() ?? '');
        await route.fallback();
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    let component = await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();

    await expect(bar.getByRole('alert')).toHaveText(
        'Potvrda nije stigla. Provjeri isti zahtjev; suncokreti se neće naplatiti dvaput.',
    );
    const retry = bar.getByRole('button', { name: 'Provjeri isti zahtjev' });
    await expect(retry).toBeEnabled();
    await expect(bar.getByRole('button', { name: 'Odbaci' })).toBeEnabled();
    // Rolled back and refetched, the command kept, Expand still locked.
    await expect
        .poll(async () =>
            (await gardenBlocks(page)).filter((block) =>
                block.id.startsWith('optimistic-'),
            ),
        )
        .toEqual([]);
    expect(await readExpandPending(page)).toBe(true);
    const stored = await readPendingCommand(page);
    expect(JSON.parse(stored ?? 'null')).toEqual({
        gardenId: 951,
        body: JSON.parse(rawBodies[0] ?? 'null'),
    });
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-uncertain.png'),
    });

    // The same request again; its response is lost too, and the bar says so.
    await retry.click();
    await expect.poll(() => rawBodies.length).toBe(2);
    await expect(retry).toBeEnabled();
    await expect(bar.getByRole('status')).toHaveText(
        'Potvrda ni ovaj put nije stigla.',
    );
    await component.unmount();

    // After a remount (a reload of the game) the command comes back.
    backend.setGarden(gardenAfter(batchBody(backend.writes[0])));
    backend.setSunflowers(940);
    component = await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    const recovered = region(page);
    await expect(recovered).toContainText('6 novih blokova');
    await expect(recovered.getByRole('alert')).toHaveText(
        'Potvrda nije stigla. Provjeri isti zahtjev; suncokreti se neće naplatiti dvaput.',
    );
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-recovery.png'),
    });
    await recovered
        .getByRole('button', { name: 'Provjeri isti zahtjev' })
        .click();
    await expectReceipt(page, recovered, 'Postavljeno: 6 blokova.');

    expect(rawBodies).toHaveLength(3);
    expect(rawBodies[1]).toBe(rawBodies[0]);
    expect(rawBodies[2]).toBe(rawBodies[0]);
    expect(await readPendingCommand(page)).toBeNull();
    expect(backend.writesTo(batchPath)).toHaveLength(3);
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('#30b Odbaci drops a lost request and unlocks Expand', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) =>
            batchPath.test(write.path) ? 'abort' : undefined,
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await bar.getByRole('button', { name: 'Odbaci' }).click();

    expect(await readPendingCommand(page)).toBeNull();
    await expect.poll(async () => await readExpandPending(page)).toBe(false);
    await expect(
        bar.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeEnabled();
    await expect(bar).toContainText('6 novih blokova');
    expect(backend.writesTo(batchPath)).toHaveLength(1);
    expect(errors).toEqual([]);
});

test('#30c a definitive answer to the same request unlocks Expand and says why', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    let attempts = 0;
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            attempts += 1;
            return attempts === 1
                ? 'abort'
                : {
                      status: 409,
                      json: {
                          code: 'GARDEN_STATE_CHANGED',
                          error: 'Garden state changed',
                          conflicts: [{ index: 0, reason: 'stack-changed' }],
                      },
                  };
        },
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await bar.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();

    // The server answered: nothing was placed. The stored command is gone,
    // Expand is unlocked and the bar says why.
    await expect(bar.getByRole('alert')).toHaveText(
        'Vrt se promijenio. Pregled je osvježen, provjeri broj blokova i potvrdi ponovno.',
    );
    await expect(
        bar.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeEnabled();
    await expect(
        bar.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toHaveCount(0);
    await expect.poll(async () => await readExpandPending(page)).toBe(false);
    expect(await readPendingCommand(page)).toBeNull();
    const batches = backend.writesTo(batchPath, 'POST');
    expect(batches).toHaveLength(2);
    expect(batchBody(batches[1]).operationId).toBe(
        batchBody(batches[0]).operationId,
    );
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-retry-conflict.png'),
    });
    expect(errors).toEqual([]);
});

/** Confirms the terrain plan and loses its response, then "reloads". */
async function storeLostTerrainRequest(
    page: Page,
    mount: ComponentFixtures['mount'],
    viewport: 'desktop' | 'phone' = 'desktop',
) {
    const component = await mount(<BlockOptionsFixture viewport={viewport} />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expect(
        bar.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toBeEnabled();
    await component.unmount();
    await mount(<BlockOptionsFixture viewport={viewport} />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await expect(region(page)).toHaveAttribute(
        'data-block-expand-hud',
        'retry',
    );
}

test('#30d a new Expand opened while a lost request is stored shows its own bar and offers the stored request', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const rawBodies: string[] = [];
    let attempts = 0;
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            attempts += 1;
            return attempts === 1
                ? 'abort'
                : { json: batchReceipt(batchBody(write), { replayed: true }) };
        },
    });
    await page.route('**/api/**/blocks/batch', async (route) => {
        rawBodies.push(route.request().postData() ?? '');
        await route.fallback();
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await storeLostTerrainRequest(page, mount);

    // The bush gets its own bar: its title, its count and Odustani. The
    // stored grass request is offered above it, and Potvrdi waits for it.
    const bush = blockOptionsFixtureBlockIds.bush;
    await startExpand(page, bush, { x: -1, z: 0 });
    const bar = region(page);
    await expect(bar).toHaveAttribute('data-block-expand-hud', 'confirm');
    await expect(bar).toContainText('1 novi blok');
    await expect(bar.getByText(/^Proširi: /)).not.toHaveText(
        'Proširi: Block Grass',
    );
    const earlier = bar.getByRole('group', { name: 'Prethodno proširivanje' });
    await expect(earlier).toContainText(
        'Prethodno: Block Grass · 6 novih blokova',
    );
    await expect(earlier.getByRole('alert')).toHaveText(
        'Potvrda nije stigla. Provjeri isti zahtjev; suncokreti se neće naplatiti dvaput.',
    );
    await expect(bar.getByRole('button', { name: 'Odustani' })).toBeEnabled();
    await expect(
        bar.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeDisabled();
    await expect(bar.getByRole('status').last()).toHaveText(
        'Prvo provjeri ili odbaci prethodno proširivanje.',
    );
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-new-with-stored.png'),
    });

    // Odustani closes the bush's Expand and brings the stored request back.
    await bar.getByRole('button', { name: 'Odustani' }).click();
    await expect(region(page)).toHaveAttribute(
        'data-block-expand-hud',
        'retry',
    );
    expect(await readEditing(page)).toBeNull();

    // Checked from above a new Expand: its receipt shows there, the bush's
    // Expand stays open and can now be confirmed.
    await startExpand(page, bush, { x: -1, z: 0 });
    await earlier
        .getByRole('button', { name: 'Provjeri isti zahtjev' })
        .click();
    await expectReceipt(page, earlier, 'Postavljeno: 6 blokova.');
    await expect(
        bar.getByRole('button', { name: 'Potvrdi postavljanje' }),
    ).toBeEnabled();
    const editing = await readEditing(page);
    expect(editing?.mode).toBe('expand');
    expect(editing?.blockId).toBe(bush);
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-new-with-receipt.png'),
    });
    // The receipt closes itself (3 s); the bush's Expand stays open.
    await expect(earlier).toHaveCount(0);
    expect((await readEditing(page))?.blockId).toBe(bush);

    expect(rawBodies).toHaveLength(2);
    expect(rawBodies[1]).toBe(rawBodies[0]);
    expect(await readPendingCommand(page)).toBeNull();
    expect(backend.writesTo(batchPath)).toHaveLength(2);
    expect(errors).toEqual([]);
});

test('#30e a definitive answer with no Expand open says nothing was placed', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    let attempts = 0;
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            attempts += 1;
            return attempts === 1
                ? 'abort'
                : {
                      status: 409,
                      json: {
                          code: 'GARDEN_STATE_CHANGED',
                          error: 'Garden state changed',
                          conflicts: [{ index: 0, reason: 'stack-changed' }],
                      },
                  };
        },
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await storeLostTerrainRequest(page, mount);
    const bar = region(page);
    await bar.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();

    await expect(bar).toHaveAttribute('data-block-expand-hud', 'close');
    await expect(bar).toContainText('Proširivanje: Block Grass');
    await expect(bar.getByRole('alert')).toHaveText(
        'Blokovi nisu postavljeni i suncokreti nisu potrošeni.',
    );
    // Nothing was placed: no count and no total.
    await expect(bar.locator('[data-block-expand-count]')).toHaveCount(0);
    await expect(bar.locator('[data-block-expand-total]')).toHaveCount(0);
    expect(await readPendingCommand(page)).toBeNull();
    await page.screenshot({
        path: test.info().outputPath('expand-desktop-not-placed.png'),
    });
    await bar.getByRole('button', { name: 'Zatvori' }).click();
    await expect(region(page)).toHaveCount(0);
    expect(backend.writesTo(batchPath)).toHaveLength(2);
    expect(errors).toEqual([]);
});

/**
 * Bottom HUD buttons (the fixture's `GameHud` stand-ins) the bar covers at
 * their centre.
 */
function readCoveredBottomControls(page: Page) {
    return page.evaluate(() => {
        const bar = document.querySelector('[data-block-expand-hud]');
        const controls = document.querySelectorAll(
            '[data-game-hud-bottom-controls] > *, [data-game-hud-bottom-items] > *',
        );
        return Array.from(controls).filter((control) => {
            const rect = control.getBoundingClientRect();
            const hit = document.elementFromPoint(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2,
            );
            return Boolean(bar && hit && bar.contains(hit));
        }).length;
    });
}

/** Space between the bar's bottom and the top of the bottom controls row. */
function readBarClearance(page: Page) {
    return page.evaluate(() => {
        const bar = document.querySelector('[data-block-expand-hud]');
        const control = document.querySelector(
            '[data-game-hud-bottom-controls] > *',
        );
        return bar && control
            ? control.getBoundingClientRect().top -
                  bar.getBoundingClientRect().bottom
            : Number.NaN;
    });
}

test('phone: with no Expand open the bar sits above the live controls row', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    let attempts = 0;
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            attempts += 1;
            return attempts === 1
                ? 'abort'
                : { json: batchReceipt(batchBody(write), { replayed: true }) };
        },
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
    await storeLostTerrainRequest(page, mount, 'phone');
    const bar = region(page);

    // The stored request after a reload: no Expand is open, so the bottom
    // rows are live and the bar sits above them, clear of their top. The
    // lift applies before the first paint (no glide from the default).
    expect(await readCoveredBottomControls(page)).toBe(0);
    expect(await readBarClearance(page)).toBeGreaterThanOrEqual(0);
    expect((await bar.boundingBox())?.y).toBeGreaterThanOrEqual(0);
    await page.screenshot({
        path: test.info().outputPath('expand-phone-recovery.png'),
    });

    // A new Expand with the stored request above it fits 360 px.
    await startExpand(page, blockOptionsFixtureBlockIds.bush, { x: -1, z: 0 });
    await expect(
        bar.getByRole('group', { name: 'Prethodno proširivanje' }),
    ).toBeVisible();
    const editingBox = await bar.boundingBox();
    expect(editingBox?.x).toBeGreaterThanOrEqual(0);
    expect(editingBox?.y).toBeGreaterThanOrEqual(0);
    expect((editingBox?.x ?? 0) + (editingBox?.width ?? 0)).toBeLessThanOrEqual(
        360,
    );
    for (const name of [
        'Odbaci',
        'Provjeri isti zahtjev',
        'Odustani',
        'Potvrdi postavljanje',
    ]) {
        const button = await bar.getByRole('button', { name }).boundingBox();
        expect(button?.height).toBeGreaterThanOrEqual(44);
    }
    expect(
        await bar.evaluate(
            (element) =>
                Array.from(element.querySelectorAll('p, button')).filter(
                    (node) => node.scrollWidth > node.clientWidth + 1,
                ).length,
        ),
    ).toBe(0);
    await page.screenshot({
        path: test.info().outputPath('expand-phone-new-with-stored.png'),
    });

    // Closed again, checked from the stored bar: the receipt also stays
    // clear of the live controls.
    await bar.getByRole('button', { name: 'Odustani' }).click();
    await expect(bar).toHaveAttribute('data-block-expand-hud', 'retry');
    expect(await readBarClearance(page)).toBeGreaterThanOrEqual(0);
    await bar.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();
    await expectReceipt(page, bar, 'Postavljeno: 6 blokova.');
    expect(await readCoveredBottomControls(page)).toBe(0);
    expect(await readBarClearance(page)).toBeGreaterThanOrEqual(0);
    await page.screenshot({
        path: test.info().outputPath('expand-phone-receipt.png'),
    });
    expect(backend.writesTo(batchPath)).toHaveLength(2);
    expect(errors).toEqual([]);
});

test('#31b a request that fails after Expand was closed from outside still says nothing was placed', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const gate = createGate();
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: async (write) => {
            if (!batchPath.test(write.path)) {
                return undefined;
            }
            await gate.opened;
            return {
                status: 409,
                json: {
                    code: 'GARDEN_STATE_CHANGED',
                    error: 'Garden state changed',
                    conflicts: [{ index: 0, reason: 'stack-changed' }],
                },
            };
        },
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await bar.getByRole('button', { name: 'Potvrdi postavljanje' }).click();
    await expect(
        bar.getByRole('button', { name: 'Provjera postavljanja…' }),
    ).toBeDisabled();

    // The 2D switch closes Expand while the batch is in flight.
    await page.evaluate(() => window.__blockOptionsProbe?.closeBlockEditing());
    gate.release();

    await expect(bar).toHaveAttribute('data-block-expand-hud', 'close');
    await expect(bar).toContainText('Proširivanje: Block Grass');
    await expect(bar.getByRole('alert')).toHaveText(
        'Blokovi nisu postavljeni i suncokreti nisu potrošeni.',
    );
    await expect(bar.locator('[data-block-expand-total]')).toHaveCount(0);
    expect(await readPendingCommand(page)).toBeNull();
    expect(backend.writesTo(batchPath)).toHaveLength(1);
    expect(errors).toEqual([]);
});

test('#31 closing Expand from outside (the 2D view switch) closes the bar and the preview', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    await expect(region(page)).toBeVisible();

    // `GameHud` closes block editing when the view mode leaves 3D; the
    // fixture has no `GameHud`, so the probe makes the same store call.
    await page.evaluate(() => window.__blockOptionsProbe?.closeBlockEditing());
    await expect(region(page)).toHaveCount(0);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__blockOptionsProbe?.countObjects('BlockExpand') ??
                    -1,
            ),
        )
        .toBe(0);
    expect(backend.writes).toEqual([]);
    expect(errors).toEqual([]);
});

test('phone: the bar fits 360 px and keeps its buttons 44 px tall', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
    await mount(<BlockOptionsFixture viewport="phone" />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSourceId });
    await startExpand(page, terrainSourceId, terrainCorner);
    const bar = region(page);
    await expect(bar).toContainText('6 novih blokova');

    const box = await bar.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
    for (const name of ['Odustani', 'Potvrdi postavljanje']) {
        const button = await bar.getByRole('button', { name }).boundingBox();
        expect(button?.height).toBeGreaterThanOrEqual(44);
    }
    // No text overflows its line.
    expect(
        await bar.evaluate(
            (element) =>
                Array.from(element.querySelectorAll('p, button')).filter(
                    (node) => node.scrollWidth > node.clientWidth + 1,
                ).length,
        ),
    ).toBe(0);
    await page.screenshot({
        path: test.info().outputPath('expand-phone-editing.png'),
    });
    expect(backend.writes).toEqual([]);
    expect(errors).toEqual([]);
});
