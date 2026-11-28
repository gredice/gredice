import type { Page } from '@playwright/test';
import {
    blockMoveCopy,
    blockOptionsToolbarCopy,
    blockRemoveCopy,
} from '../../../packages/game/src/blockOptions/blockOptionsCopy';
import { BlockOptionsFixture } from '../../../packages/game/tests/BlockOptionsFixture';
import {
    blockOptionsFixtureBlockIds,
    blockOptionsFixtureGroundId,
    blockOptionsFixtureRaisedBedId,
    blockOptionsFixtureStageSizes,
    createBlockOptionsFixtureBlockData,
    createBlockOptionsFixtureGarden,
    createBlockOptionsFixtureStacks,
} from '../../../packages/game/tests/blockOptionsFixtureData';
import {
    captureBlockOptionsReview,
    collectPageErrors,
    createBlockOptionsTouch,
    installBlockOptionsBackend,
    readBlockOptionsProbe,
    waitForBlockOptionsFixture,
} from './blockOptionsTestSupport';
import { expect as baseExpect, test } from './webglComponentTest';

// Block options pop-up, Okreni, Recikliraj/Obriši and Pomakni (spec §14.3
// #2-#9 and #32). The pop-up opens through the fixture probe, as a
// hold-release would; every write is stubbed and recorded by the harness.

test.setTimeout(90_000);
// As in block-options-expand.spec.tsx: one frame of the fixture garden can
// take a second or more on the CI software renderer, so assertions wait
// longer than the default 5 s.
const expect = baseExpect.configure({ timeout: 15_000 });

const { beachBall, bush, gardenBox, raisedBed } = blockOptionsFixtureBlockIds;
const { actions, disabledReasons } = blockOptionsToolbarCopy;
const blockData = createBlockOptionsFixtureBlockData();
/** The pop-up ignores taps this soon after it opened (ghost clicks). */
const ghostClickGuardMs = 320;
/** Gap between the pop-up and its anchor (`blockOptionsPopupGap`). */
const popupGap = 12;

function labelOf(name: string) {
    return (
        blockData.find((data) => data.information.name === name)?.information
            .label || name
    );
}

const popup = (page: Page) => page.locator('[data-block-options-popup]');
const tile = (page: Page, id: string) =>
    page.locator(`[data-block-options-action="${id}"]`);

async function setUp(page: Page) {
    const errors = collectPageErrors(page);
    // Effect sounds come from the CDN; keep the tests offline.
    await page.route('https://cdn.gredice.com/**', (route) =>
        route.fulfill({ status: 404, body: '' }),
    );
    return errors;
}

async function openBlockOptions(
    page: Page,
    blockId: string,
    pointerType = 'mouse',
) {
    // Opening over an open pop-up keeps its layer, still marked placed, and
    // the bubble moves to the new block only on the next rendered frame (a
    // second or more on the CI software renderer), so tile boxes read before
    // then belong to the previous block. Close it first, as the canvas press
    // that starts a hold on another block does.
    if ((await readEditingMode(page)) === 'menu') {
        await page.evaluate(() =>
            window.__blockOptionsProbe?.closeBlockEditing(),
        );
        await expect(
            page.locator('[data-block-options-popup-layer]'),
        ).toHaveCount(0);
    }
    const opened = await page.evaluate(
        ([id, pointer]) =>
            window.__blockOptionsProbe?.openBlockOptions(id, pointer) ?? null,
        [blockId, pointerType] as const,
    );
    expect(opened?.mode).toBe('menu');
    await expect(
        page.locator('[data-block-options-popup-layer][data-placed="true"]'),
    ).toBeVisible();
    // Past the ghost-click guard, and the opening pop has settled, so the
    // tiles are where a press lands (a busy machine can stretch the pop).
    await page.waitForTimeout(ghostClickGuardMs);
    await popup(page).evaluate((element) =>
        Promise.all(
            element
                .getAnimations()
                .map((animation) => animation.finished.catch(() => undefined)),
        ),
    );
}

/**
 * A quick touch tap. The event times are set explicitly, 50 ms apart: under
 * load the renderer can take long enough to acknowledge the touch start that
 * an untimed touch end would arrive as a long press, which fires no click.
 */
async function tapWithTouch(page: Page, point: { x: number; y: number }) {
    const cdp = await page.context().newCDPSession(page);
    const startedAt = Date.now() / 1000;
    try {
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: point.x, y: point.y, id: 1 }],
            timestamp: startedAt,
        });
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
            timestamp: startedAt + 0.05,
        });
    } finally {
        await cdp.detach();
    }
}

function readEditingMode(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.blockEditing?.mode ?? null,
    );
}

function createDeferred() {
    let resolve = () => {};
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

/**
 * Finds the fixture's game store and query client through React's fiber
 * tree (the probe does not expose them) and keeps them on `window`, so a
 * test can start a batch mutation or a stand-in move receiver.
 */
async function exposeFixtureInternals(page: Page) {
    const found = await page.evaluate(`(() => {
        const root = document.querySelector('[data-block-options-fixture]');
        const key = root && Object.keys(root).find((name) => name.startsWith('__reactFiber$'));
        let fiber = key ? root[key] : null;
        const internals = {};
        while (fiber) {
            const props = fiber.memoizedProps;
            if (props && props.client && typeof props.client.getQueryCache === 'function') {
                internals.queryClient = props.client;
            }
            if (props && props.value && typeof props.value.getState === 'function'
                && typeof props.value.getState().openBlockOptions === 'function') {
                internals.store = props.value;
            }
            fiber = fiber.return;
        }
        window.__blockOptionsPopupInternals = internals;
        return Boolean(internals.queryClient && internals.store);
    })()`);
    expect(found).toBe(true);
}

async function popupBox(page: Page) {
    const box = await popup(page).boundingBox();
    if (!box) {
        throw new Error('The pop-up is not on screen.');
    }
    return box;
}

async function canvasBox(page: Page) {
    const box = await page.locator('canvas').boundingBox();
    if (!box) {
        throw new Error('The canvas is not on screen.');
    }
    return box;
}

function intersects(
    left: { left: number; top: number; right: number; bottom: number },
    right: { left: number; top: number; right: number; bottom: number },
) {
    return (
        Math.min(left.right, right.right) > Math.max(left.left, right.left) &&
        Math.min(left.bottom, right.bottom) > Math.max(left.top, right.top)
    );
}

async function blockAnchor(page: Page, blockId: string) {
    const point = await page.evaluate(
        (id) =>
            window.__blockOptionsProbe?.blockScreenPosition(id, 'anchor') ??
            null,
        blockId,
    );
    if (!point) {
        throw new Error(`No screen position for ${blockId}.`);
    }
    return point;
}

/** Where the tail tip of an `above` pop-up points, in client pixels. */
async function readTailTip(page: Page) {
    const box = await popupBox(page);
    const placement = await popup(page).evaluate((element) => ({
        side: element.getAttribute('data-side'),
        tail: Number.parseFloat(
            getComputedStyle(element).getPropertyValue('--block-options-tail'),
        ),
    }));
    return {
        side: placement.side,
        x: box.x + placement.tail,
        y: box.y + box.height + popupGap,
    };
}

test('opens four labelled tiles next to the block without taking focus, and arrow keys still pan', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: beachBall });

    await openBlockOptions(page, beachBall);
    const toolbar = page.getByRole('toolbar', {
        name: blockOptionsToolbarCopy.toolbarLabel(labelOf('BeachBall')),
    });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button')).toHaveText([
        actions.expand,
        actions.rotate,
        actions.recycle,
        actions.move,
    ]);
    for (const button of await toolbar.getByRole('button').all()) {
        await expect(button).not.toHaveAttribute('aria-disabled', 'true');
    }
    // Tiles are at least 44 px tall (spec §11).
    for (const button of await toolbar.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    // Opening never moves focus (D16).
    expect(
        await page.evaluate(() => document.activeElement === document.body),
    ).toBe(true);

    // The tail points at the block's anchor.
    const anchor = await blockAnchor(page, beachBall);
    const tip = await readTailTip(page);
    expect(tip.side).toBe('above');
    expect(Math.abs(tip.x - anchor.x)).toBeLessThan(1.5);
    expect(Math.abs(tip.y - anchor.y)).toBeLessThan(1.5);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('popup-desktop-beach-ball.png'),
    });

    // Arrow keys still pan the camera, and the pop-up follows the block.
    const cameraBefore = (await readBlockOptionsProbe(page))?.camera.position;
    const boxBefore = await popupBox(page);
    // Hold the key until the camera has moved (frames can be slow here).
    await page.keyboard.down('ArrowRight');
    await expect
        .poll(async () => (await readBlockOptionsProbe(page))?.camera.position)
        .not.toEqual(cameraBefore);
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowRight');
    await expect.poll(() => readEditingMode(page)).toBe('menu');
    await expect
        .poll(async () => (await popupBox(page)).x)
        .not.toBe(boxBefore.x);
    await page.waitForTimeout(300);
    const followed = await readTailTip(page);
    const movedAnchor = await blockAnchor(page, beachBall);
    expect(Math.abs(followed.x - movedAnchor.x)).toBeLessThan(1.5);
    expect(Math.abs(followed.y - movedAnchor.y)).toBeLessThan(1.5);

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('Okreni sends the next normalized rotation, waits for the save and keeps the pop-up open', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const saved = createDeferred();
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: async (write) => {
            if (write.method === 'PUT') {
                await saved.promise;
            }
            return undefined;
        },
    });
    // A stored rotation of 5 is one quarter turn: the next is 2, not 6.
    const stacks = createBlockOptionsFixtureStacks();
    for (const stack of stacks) {
        for (const block of stack.blocks) {
            if (block.id === beachBall) {
                block.rotation = 5;
            }
        }
    }
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture stacks={stacks} />);
    await waitForBlockOptionsFixture(page, { blockId: beachBall });
    await openBlockOptions(page, beachBall);

    await tile(page, 'rotate').click();
    await expect
        .poll(() => backend.writesTo(/\/blocks\/beach-ball$/, 'PUT').length)
        .toBe(1);
    expect(backend.writes).toEqual([
        expect.objectContaining({
            method: 'PUT',
            path: '/api/gardens/951/blocks/beach-ball',
            body: { rotation: 2 },
        }),
    ]);
    // Okreni waits for its own save; the pop-up stays open.
    await expect(tile(page, 'rotate')).toHaveAttribute('aria-disabled', 'true');
    await expect(tile(page, 'rotate')).toContainText(
        disabledReasons.rotatePending,
    );
    await tile(page, 'rotate').click({ force: true });
    await expect(page.locator('[data-block-options-status]')).toHaveText(
        disabledReasons.rotatePending,
    );
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('popup-rotate-pending.png'),
    });
    expect(backend.writesTo(/\/blocks\//, 'PUT')).toHaveLength(1);

    saved.resolve();
    await expect(tile(page, 'rotate')).not.toHaveAttribute(
        'aria-disabled',
        'true',
    );
    expect(await readEditingMode(page)).toBe('menu');
    await expect(popup(page)).toBeVisible();

    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('unavailable tiles explain themselves and send nothing', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: raisedBed });
    await openBlockOptions(page, raisedBed);

    const status = page.locator('[data-block-options-status]');
    await expect(status).toBeEmpty();
    for (const [id, reason] of [
        ['rotate', disabledReasons.notRotatable],
        ['expand', disabledReasons.notExpandable],
        ['remove', disabledReasons.activeRaisedBed],
    ] as const) {
        await expect(tile(page, id)).toHaveAttribute('aria-disabled', 'true');
        await tile(page, id).click({ force: true });
        await expect(status).toHaveText(reason);
        expect(await readEditingMode(page)).toBe('menu');
    }
    await expect(tile(page, 'move')).not.toHaveAttribute(
        'aria-disabled',
        'true',
    );
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('popup-disabled-reason.png'),
    });

    // A garden box cannot be removed either.
    await openBlockOptions(page, gardenBox);
    await expect(status).toBeEmpty();
    await tile(page, 'remove').click({ force: true });
    await expect(status).toHaveText(disabledReasons.notRemovable);

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('Recikliraj confirms first, shows the refund, stays put while saving and reports a failure', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    let failNext = false;
    let saved = createDeferred();
    const backend = await installBlockOptionsBackend(page, {
        respondToWrite: async (write) => {
            if (write.method !== 'PATCH') {
                return undefined;
            }
            if (failNext) {
                failNext = false;
                return { status: 500, json: { error: 'Stub failure' } };
            }
            await saved.promise;
            return undefined;
        },
    });
    // The bush was bought for 25 sunflowers; recycling gives exactly that.
    const stacks = createBlockOptionsFixtureStacks();
    for (const stack of stacks) {
        for (const block of stack.blocks) {
            if (block.id === bush) {
                block.paidSunflowers = 25;
            }
        }
    }
    backend.setGarden(createBlockOptionsFixtureGarden({ stacks }));
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture stacks={stacks} />);
    await waitForBlockOptionsFixture(page, { blockId: bush });

    // Odustani sends nothing and closes editing.
    await openBlockOptions(page, bush);
    await tile(page, 'remove').click();
    const dialog = page.getByRole('dialog');
    const header = blockRemoveCopy.recycle.header(labelOf('Bush'));
    await expect(page.getByRole('dialog', { name: header })).toBeVisible();
    await expect(dialog).toContainText(header);
    await expect(dialog.locator('[data-block-remove-body]')).toHaveText(
        blockRemoveCopy.body({ label: labelOf('Bush') }),
    );
    await expect(dialog.locator('[data-block-remove-refund]')).toHaveText(
        blockRemoveCopy.refund(25),
    );
    await expect(dialog).toHaveAccessibleDescription(
        `${blockRemoveCopy.body({ label: labelOf('Bush') })} ${blockRemoveCopy.refund(25)}`,
    );
    await expect(popup(page)).toHaveCount(0);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('remove-dialog-recycle.png'),
    });
    await dialog.getByRole('button', { name: blockRemoveCopy.cancel }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => readEditingMode(page)).toBeNull();
    expect(backend.writes).toEqual([]);

    // Potvrdi: one stack patch; the dialog cannot be dismissed while it runs.
    await openBlockOptions(page, bush);
    await tile(page, 'remove').click();
    await dialog
        .getByRole('button', { name: blockRemoveCopy.recycle.confirm })
        .click();
    await expect
        .poll(() => backend.writesTo(/\/stacks$/, 'PATCH').length)
        .toBe(1);
    expect(backend.writes[0]).toMatchObject({
        method: 'PATCH',
        path: '/api/gardens/951/stacks',
        body: [
            { op: 'test', path: '/-2/0/1', value: bush },
            { op: 'remove', path: '/-2/0/1' },
        ],
    });
    await expect(
        dialog.getByRole('button', { name: blockRemoveCopy.cancel }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    // The optimistic removal hides the bush, but the dialog keeps its text.
    await expect(dialog.locator('[data-block-remove-refund]')).toHaveText(
        blockRemoveCopy.refund(25),
    );
    expect((await readBlockOptionsProbe(page))?.blockEditing).toMatchObject({
        mode: 'confirm-remove',
        pending: true,
    });
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('remove-dialog-pending.png'),
    });
    saved.resolve();
    // The save refetches the garden before the dialog closes.
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(() => readEditingMode(page)).toBeNull();

    // A failed removal keeps the dialog open with the error and restores
    // the block; Odustani then closes it.
    saved = createDeferred();
    saved.resolve();
    await expect
        .poll(async () =>
            (await readBlockOptionsProbe(page))?.garden?.blocks.some(
                (block) => block.id === bush,
            ),
        )
        .toBe(true);
    failNext = true;
    await openBlockOptions(page, bush);
    await tile(page, 'remove').click();
    await dialog
        .getByRole('button', { name: blockRemoveCopy.recycle.confirm })
        .click();
    await expect(dialog.getByRole('alert')).toHaveText(blockRemoveCopy.error);
    await expect(dialog).toBeVisible();
    expect((await readBlockOptionsProbe(page))?.blockEditing).toMatchObject({
        mode: 'confirm-remove',
        pending: false,
    });
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('remove-dialog-error.png'),
    });
    await dialog.getByRole('button', { name: blockRemoveCopy.cancel }).click();
    await expect(dialog).toHaveCount(0);

    expect(backend.writesTo(/\/stacks$/, 'PATCH')).toHaveLength(2);
    expect(backend.writes).toHaveLength(2);
    // The failed request logs its own error; no page error.
    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('removing a block with things on it deletes them all, bottom first', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    const ground = blockOptionsFixtureGroundId(0, 0);
    await waitForBlockOptionsFixture(page, { blockId: ground });

    await openBlockOptions(page, ground);
    await tile(page, 'remove').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-block-remove-body]')).toHaveText(
        blockRemoveCopy.body({
            label: labelOf('Block_Grass'),
            stackedCount: 1,
        }),
    );
    // Neither block has a stored paid price, so no amount is promised.
    await expect(dialog.locator('[data-block-remove-refund]')).toHaveText(
        blockRemoveCopy.refundUnknown,
    );
    // What goes with the block and the refund are read with the title.
    await expect(dialog).toHaveAccessibleDescription(
        `${blockRemoveCopy.body({
            label: labelOf('Block_Grass'),
            stackedCount: 1,
        })} ${blockRemoveCopy.refundUnknown}`,
    );
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('remove-dialog-stacked.png'),
    });
    await dialog
        .getByRole('button', { name: blockRemoveCopy.recycle.confirm })
        .click();
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(() => backend.writes.length).toBe(2);
    expect(backend.writes.map((write) => [write.method, write.path])).toEqual([
        ['DELETE', `/api/gardens/951/blocks/${ground}`],
        ['DELETE', `/api/gardens/951/blocks/${beachBall}`],
    ]);

    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('sandbox gardens offer Obriši and delete without a refund line', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page, {
        garden: createBlockOptionsFixtureGarden({ sandbox: true }),
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture sandbox />);
    await waitForBlockOptionsFixture(page, { blockId: bush });

    await openBlockOptions(page, bush);
    await expect(tile(page, 'remove')).toHaveText(actions.delete);
    await tile(page, 'remove').click();
    const dialog = page.getByRole('dialog');
    const header = blockRemoveCopy.delete.header(labelOf('Bush'));
    await expect(page.getByRole('dialog', { name: header })).toBeVisible();
    await expect(dialog).toContainText(header);
    await expect(dialog.locator('[data-block-remove-refund]')).toHaveCount(0);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('remove-dialog-sandbox.png'),
    });
    await dialog
        .getByRole('button', { name: blockRemoveCopy.delete.confirm })
        .click();
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(() => backend.writes.length).toBe(1);
    expect(backend.writes[0]).toMatchObject({
        method: 'DELETE',
        path: `/api/gardens/951/blocks/${bush}`,
    });

    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('recycling a new raised bed names its cart items and removes them too', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const stacks = createBlockOptionsFixtureStacks();
    for (const stack of stacks) {
        for (const block of stack.blocks) {
            if (block.id === raisedBed) {
                block.paidSunflowers = 100;
            }
        }
    }
    const fixtureGarden = createBlockOptionsFixtureGarden({ stacks });
    const newRaisedBedGarden = {
        ...fixtureGarden,
        raisedBeds: fixtureGarden.raisedBeds.map((bed) => ({
            ...bed,
            status: 'new',
        })),
    };
    const backend = await installBlockOptionsBackend(page, {
        garden: newRaisedBedGarden,
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture stacks={stacks} />);
    await waitForBlockOptionsFixture(page, { blockId: raisedBed });
    // The fixture starts approved; refetch the new raised bed and give the
    // cart two items for it (and one for another bed).
    await page.evaluate(() => window.__blockOptionsProbe?.invalidateGarden());
    await exposeFixtureInternals(page);
    await page.evaluate(`(() => {
        const { queryClient } = window.__blockOptionsPopupInternals;
        const cart = queryClient.getQueryData(['shopping-cart']);
        const item = (id, raisedBedId) => ({
            id, cartId: 1, entityId: String(id), entityTypeName: 'plantSort',
            gardenId: 951, raisedBedId, positionIndex: id, amount: 1,
            currency: 'eur', status: 'new', isDeleted: false,
        });
        queryClient.setQueryData(['shopping-cart'], {
            ...cart,
            items: [item(1, ${blockOptionsFixtureRaisedBedId}), item(2, ${blockOptionsFixtureRaisedBedId}), item(3, 9)],
        });
    })()`);

    await openBlockOptions(page, raisedBed);
    await expect(tile(page, 'remove')).not.toHaveAttribute(
        'aria-disabled',
        'true',
    );
    await tile(page, 'remove').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-block-remove-body]')).toHaveText(
        blockRemoveCopy.body({
            label: labelOf('Raised_Bed'),
            cartItemCount: 2,
        }),
    );
    await expect(dialog.locator('[data-block-remove-refund]')).toHaveText(
        blockRemoveCopy.refund(100),
    );
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('remove-dialog-raised-bed-cart.png'),
    });
    await dialog
        .getByRole('button', { name: blockRemoveCopy.recycle.confirm })
        .click();
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(() => backend.writes.length).toBe(3);
    expect(backend.writes[0]).toMatchObject({
        method: 'PATCH',
        path: '/api/gardens/951/stacks',
        body: [
            { op: 'test', path: '/-3/2/1', value: raisedBed },
            { op: 'remove', path: '/-3/2/1' },
        ],
    });
    // Both cart items of this bed are emptied (in parallel, any order).
    const cartWrites = backend
        .writesTo(/\/shopping-cart$/, 'POST')
        .map((write) => JSON.stringify(write.body));
    expect(cartWrites).toHaveLength(2);
    for (const id of [1, 2]) {
        expect(
            cartWrites.some(
                (body) =>
                    body.includes(`"id":${id},`) && body.includes('"amount":0'),
            ),
        ).toBe(true);
    }

    expect(errors).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('the pop-up steers clear of the HUD near the top-left corner', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: gardenBox });

    // Drag the sky to pan until the garden box sits just under the
    // top-left HUD, where a pop-up above it would cover the HUD.
    const target = { x: 180, y: 140 };
    const sky = { x: 760, y: 130 };
    for (let round = 0; round < 4; round++) {
        const current = await blockAnchor(page, gardenBox);
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        if (Math.hypot(dx, dy) < 12) {
            break;
        }
        expect(
            await page.evaluate(
                ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
                sky,
            ),
        ).toBe('CANVAS');
        await page.mouse.move(sky.x, sky.y);
        await page.mouse.down();
        await page.mouse.move(sky.x + dx, sky.y + dy, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(400);
    }
    const anchor = await blockAnchor(page, gardenBox);
    expect(Math.abs(anchor.x - target.x)).toBeLessThan(24);
    expect(Math.abs(anchor.y - target.y)).toBeLessThan(24);

    await openBlockOptions(page, gardenBox);
    const probe = await readBlockOptionsProbe(page);
    const obstacles = probe?.hudObstacles ?? [];
    expect(obstacles.length).toBeGreaterThan(0);
    const box = await popupBox(page);
    const canvas = await canvasBox(page);
    // Centred above the block, the pop-up would cover the top-left HUD.
    const naiveLeft = Math.min(
        Math.max(anchor.x - box.width / 2, canvas.x + 8),
        canvas.x + canvas.width - 8 - box.width,
    );
    const naiveAbove = {
        left: naiveLeft,
        top: anchor.y - popupGap - box.height,
        right: naiveLeft + box.width,
        bottom: anchor.y - popupGap,
    };
    expect(obstacles.some((rect) => intersects(naiveAbove, rect))).toBe(true);

    const placed = {
        left: box.x,
        top: box.y,
        right: box.x + box.width,
        bottom: box.y + box.height,
    };
    for (const rect of obstacles) {
        expect(intersects(placed, rect), JSON.stringify(rect)).toBe(false);
    }
    expect(placed.left).toBeGreaterThanOrEqual(canvas.x + 7.5);
    expect(placed.top).toBeGreaterThanOrEqual(canvas.y + 7.5);
    expect(await popup(page).getAttribute('data-side')).not.toBe('above');
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('popup-avoids-top-left-hud.png'),
    });

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('Escape and a canvas press close the pop-up; wheel zoom keeps it on the block', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: beachBall });

    await openBlockOptions(page, beachBall);
    await page.keyboard.press('Escape');
    await expect.poll(() => readEditingMode(page)).toBeNull();
    await expect(popup(page)).toHaveCount(0);

    // A press on the canvas (sky above the garden) closes the pop-up.
    const sky = { x: 760, y: 130 };
    expect(
        await page.evaluate(
            ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
            sky,
        ),
    ).toBe('CANVAS');
    await openBlockOptions(page, beachBall);
    await page.mouse.click(sky.x, sky.y);
    await expect.poll(() => readEditingMode(page)).toBeNull();

    // Wheel zoom keeps it open, and the tail follows the block.
    await openBlockOptions(page, beachBall);
    const zoomBefore = (await readBlockOptionsProbe(page))?.camera.zoom ?? 0;
    await page.mouse.move(sky.x, sky.y);
    await page.mouse.wheel(0, -400);
    await expect
        .poll(async () => (await readBlockOptionsProbe(page))?.camera.zoom)
        .not.toBe(zoomBefore);
    // Let the zoom settle.
    let previousZoom = Number.NaN;
    await expect
        .poll(async () => {
            const zoom = (await readBlockOptionsProbe(page))?.camera.zoom;
            const settled = zoom === previousZoom;
            previousZoom = zoom ?? Number.NaN;
            return settled;
        })
        .toBe(true);
    await page.waitForTimeout(200);
    expect(await readEditingMode(page)).toBe('menu');
    const anchor = await blockAnchor(page, beachBall);
    const tip = await readTailTip(page);
    expect(tip.side).toBe('above');
    expect(Math.abs(tip.x - anchor.x)).toBeLessThan(1.5);
    expect(Math.abs(tip.y - anchor.y)).toBeLessThan(1.5);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('popup-after-wheel-zoom.png'),
    });

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('unsaved blocks and a pending Expand batch disable every tile with the reason', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page);
    const unsaved = 'optimistic-block:bush-copy';
    const stacks = createBlockOptionsFixtureStacks();
    stacks
        .find((stack) => stack.position.x === -1 && stack.position.z === 0)
        ?.blocks.push({ id: unsaved, name: 'Bush', rotation: 0 });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture stacks={stacks} />);
    await waitForBlockOptionsFixture(page, { blockId: unsaved });

    const status = page.locator('[data-block-options-status]');
    await openBlockOptions(page, unsaved);
    for (const id of ['expand', 'rotate', 'remove', 'move']) {
        await expect(tile(page, id)).toHaveAttribute('aria-disabled', 'true');
        await expect(tile(page, id)).toContainText(disabledReasons.unsaved);
    }
    await tile(page, 'rotate').click({ force: true });
    await expect(status).toHaveText(disabledReasons.unsaved);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('popup-unsaved-block.png'),
    });
    await page.keyboard.press('Escape');

    // A batch still saving blocks every action on every block.
    await exposeFixtureInternals(page);
    await page.evaluate(`(() => {
        const { queryClient } = window.__blockOptionsPopupInternals;
        const mutation = queryClient.getMutationCache().build(queryClient, {
            mutationKey: ['gardens', 'current', 'blockPlace', 'batch'],
            mutationFn: () => new Promise((resolve) => {
                window.__blockOptionsReleaseBatch = resolve;
            }),
        });
        mutation.execute(undefined).catch(() => {});
    })()`);
    await openBlockOptions(page, bush);
    for (const id of ['expand', 'rotate', 'remove', 'move']) {
        await expect(tile(page, id)).toHaveAttribute('aria-disabled', 'true');
        await expect(tile(page, id)).toContainText(
            disabledReasons.expandPending,
        );
    }
    await tile(page, 'remove').click({ force: true });
    await expect(status).toHaveText(disabledReasons.expandPending);
    expect(await readEditingMode(page)).toBe('menu');
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('popup-batch-pending.png'),
    });
    await page.evaluate('window.__blockOptionsReleaseBatch()');
    await expect(tile(page, 'remove')).not.toHaveAttribute(
        'aria-disabled',
        'true',
    );

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('Pomakni hands the press to the move, hides the toolbar until it ends and shows the carry hint', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: bush });

    await openBlockOptions(page, bush);
    const move = tile(page, 'move');
    const moveBox = await move.boundingBox();
    if (!moveBox) {
        throw new Error('Pomakni is not on screen.');
    }
    await page.mouse.move(
        moveBox.x + moveBox.width / 2,
        moveBox.y + moveBox.height / 2,
    );
    await page.mouse.down();
    // The press itself starts the move (a gesture-layer receiver claims it).
    await expect.poll(() => readEditingMode(page)).toBe('moving');
    expect((await readBlockOptionsProbe(page))?.pickupBlockId).toBe(bush);
    // Hidden, but still in the page for the rest of the press.
    await expect(popup(page)).toHaveCount(1);
    await expect(popup(page)).toBeHidden();
    await expect(popup(page)).toHaveCSS('pointer-events', 'none');
    await page.mouse.up();

    // Released without a drag: carry mode with its hint above the block.
    await expect.poll(() => readEditingMode(page)).toBe('carry');
    const hint = page.locator('[data-block-move-carry-bubble]');
    await expect(hint).toHaveText(blockMoveCopy.carryMouse);
    // Screen readers get the hint from the HUD's live region, which exists
    // before the text arrives; the bubble itself is hidden from them.
    const announcer = page.locator('[data-block-move-carry-announcer]');
    await expect(announcer).toHaveAttribute('role', 'status');
    await expect(announcer).toHaveText(blockMoveCopy.carryMouse);
    await expect(hint).toHaveAttribute('aria-hidden', 'true');
    await expect(hint).toHaveCSS('pointer-events', 'none');
    await expect(popup(page)).toHaveCount(0);
    // It sits above the block once its fade-in has finished.
    await expect(hint).toHaveCSS('opacity', '1');
    const hintBox = await hint.boundingBox();
    const bushAnchor = await blockAnchor(page, bush);
    expect(hintBox).not.toBeNull();
    if (hintBox) {
        expect(
            Math.abs(hintBox.x + hintBox.width / 2 - bushAnchor.x),
        ).toBeLessThan(2);
        expect(hintBox.y + hintBox.height).toBeLessThan(bushAnchor.y);
    }
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('carry-hint-mouse.png'),
    });
    // Escape puts the block back; the hint goes with the move.
    await page.keyboard.press('Escape');
    await expect.poll(() => readEditingMode(page)).toBeNull();
    await expect(hint).toHaveCount(0);
    await expect(announcer).toHaveText('');
    await expect
        .poll(async () => (await readBlockOptionsProbe(page))?.pickupBlockId)
        .toBeNull();

    // Enter on a focused Pomakni starts a carry move without a pointer;
    // the focus that was in the toolbar goes back to the page.
    await openBlockOptions(page, bush);
    await move.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => readEditingMode(page)).toBe('carry');
    await expect(hint).toBeVisible();
    expect(
        await page.evaluate(() => document.activeElement === document.body),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => readEditingMode(page)).toBeNull();

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('keyboard: arrows, Home and End move between tiles without panning the camera', async ({
    mount,
    page,
}) => {
    const errors = await setUp(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: beachBall });
    await openBlockOptions(page, beachBall);

    await tile(page, 'expand').focus();
    await expect(tile(page, 'expand')).toBeFocused();
    const camera = (await readBlockOptionsProbe(page))?.camera.position;
    await page.keyboard.press('ArrowRight');
    await expect(tile(page, 'rotate')).toBeFocused();
    await page.keyboard.press('End');
    await expect(tile(page, 'move')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tile(page, 'expand')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tile(page, 'expand')).toBeFocused();
    // Holding an arrow inside the toolbar does not pan.
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowLeft');
    await expect(tile(page, 'move')).toBeFocused();
    expect((await readBlockOptionsProbe(page))?.camera.position).toEqual(
        camera,
    );
    // Only one tile is in the tab order.
    await expect(
        page.locator('[data-block-options-action][tabindex="0"]'),
    ).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => readEditingMode(page)).toBeNull();
    expect(
        await page.evaluate(() => document.activeElement === document.body),
    ).toBe(true);

    // With the toolbar closed, the same key pans the camera again.
    await page.keyboard.down('ArrowLeft');
    await expect
        .poll(async () => (await readBlockOptionsProbe(page))?.camera.position)
        .not.toEqual(camera);
    await page.keyboard.up('ArrowLeft');

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test.describe('reduced motion', () => {
    /**
     * Opens the pop-up, pauses its opening animation and reads the scale at
     * every 5 ms of it, so the curve does not depend on the frame rate.
     */
    async function sampleOpeningScale(page: Page, blockId: string) {
        // Opens the pop-up and samples its `enter` animation in one page
        // task: the sampler is armed before the pop-up renders, so a slow
        // software-rendered frame cannot let the 450 ms animation finish
        // (and leave `getAnimations()`) before it is found.
        return page.evaluate(
            (id) =>
                new Promise<{
                    scales: number[];
                    animation: string;
                    duration: number;
                }>((resolve) => {
                    const started = performance.now();
                    const scaleOf = (element: Element) => {
                        const transform = getComputedStyle(element).transform;
                        return transform === 'none'
                            ? 1
                            : new DOMMatrixReadOnly(transform).a;
                    };
                    const find = () => {
                        const element = document.querySelector(
                            '[data-block-options-popup]',
                        );
                        const animation = element
                            ?.getAnimations()
                            .find(
                                (candidate) =>
                                    candidate instanceof CSSAnimation &&
                                    candidate.animationName === 'enter',
                            );
                        if (!element || !(animation instanceof CSSAnimation)) {
                            if (performance.now() - started < 5000) {
                                requestAnimationFrame(find);
                            } else {
                                resolve({
                                    scales: [],
                                    animation: '',
                                    duration: 0,
                                });
                            }
                            return;
                        }
                        animation.pause();
                        const duration = Number(
                            animation.effect?.getComputedTiming().duration ?? 0,
                        );
                        const scales: number[] = [];
                        for (let time = 0; time <= duration; time += 5) {
                            animation.currentTime = time;
                            scales.push(scaleOf(element));
                        }
                        animation.finish();
                        scales.push(scaleOf(element));
                        resolve({
                            scales,
                            animation: animation.animationName,
                            duration,
                        });
                    };
                    window.__blockOptionsProbe?.openBlockOptions(id);
                    find();
                }),
            blockId,
        );
    }

    test('the pop-up pops with a small overshoot, and only fades with reduced motion', async ({
        mount,
        page,
    }) => {
        const errors = await setUp(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
        await mount(<BlockOptionsFixture />);
        await waitForBlockOptionsFixture(page, { blockId: beachBall });

        const popping = await sampleOpeningScale(page, beachBall);
        expect(popping.animation).toBe('enter');
        // Settles within 450 ms.
        expect(popping.duration).toBeGreaterThan(0);
        expect(popping.duration).toBeLessThanOrEqual(450);
        expect(popping.scales.length).toBeGreaterThan(3);
        expect(Math.min(...popping.scales)).toBeLessThan(0.95);
        // Overshoot of 6-10% (GAME_ART.md), then settled at 1.
        expect(Math.max(...popping.scales)).toBeGreaterThan(1.04);
        expect(Math.max(...popping.scales)).toBeLessThan(1.1);
        expect(popping.scales.at(-1)).toBe(1);
        await page.keyboard.press('Escape');
        await expect.poll(() => readEditingMode(page)).toBeNull();

        await page.emulateMedia({ reducedMotion: 'reduce' });
        const calm = await sampleOpeningScale(page, beachBall);
        expect(calm.animation).toBe('enter');
        expect(calm.scales.length).toBeGreaterThan(3);
        expect(calm.scales.every((scale) => scale === 1)).toBe(true);

        expect(errors).toEqual([]);
        expect(backend.writes).toEqual([]);
        expect(backend.unhandledGets).toEqual([]);
    });
});

test.describe('phone', () => {
    test.use({ hasTouch: true });

    test('the toolbar fits a 360 px canvas, labels do not overflow and a tap on an unavailable tile explains it', async ({
        mount,
        page,
    }) => {
        const errors = await setUp(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
        await mount(<BlockOptionsFixture viewport="phone" />);
        await waitForBlockOptionsFixture(page, { blockId: raisedBed });
        const canvas = await canvasBox(page);

        for (const blockId of Object.values(blockOptionsFixtureBlockIds)) {
            await openBlockOptions(page, blockId, 'touch');
            const box = await popupBox(page);
            expect(box.x, blockId).toBeGreaterThanOrEqual(canvas.x + 7.5);
            expect(box.y, blockId).toBeGreaterThanOrEqual(canvas.y + 7.5);
            expect(box.x + box.width, blockId).toBeLessThanOrEqual(
                canvas.x + canvas.width - 7.5,
            );
            expect(box.y + box.height, blockId).toBeLessThanOrEqual(
                canvas.y + canvas.height - 7.5,
            );
            const overflowing = await page.evaluate(
                () =>
                    Array.from(
                        document.querySelectorAll(
                            '[data-block-options-action]',
                        ),
                    ).filter((button) => {
                        const label = button.querySelector(
                            '[data-block-options-label]',
                        );
                        const buttonRect = button.getBoundingClientRect();
                        const labelRect = label?.getBoundingClientRect();
                        return (
                            button.scrollWidth > button.clientWidth ||
                            !labelRect ||
                            labelRect.left < buttonRect.left - 0.5 ||
                            labelRect.right > buttonRect.right + 0.5
                        );
                    }).length,
            );
            expect(overflowing, blockId).toBe(0);
        }

        // A real touch tap on an unavailable tile shows why (aria-disabled
        // tiles stay pressable).
        await openBlockOptions(page, raisedBed, 'touch');
        const rotate = await tile(page, 'rotate').boundingBox();
        if (!rotate) {
            throw new Error('Okreni is not on screen.');
        }
        await tapWithTouch(page, {
            x: rotate.x + rotate.width / 2,
            y: rotate.y + rotate.height / 2,
        });
        await expect(page.locator('[data-block-options-status]')).toHaveText(
            disabledReasons.notRotatable,
        );
        expect(await readEditingMode(page)).toBe('menu');
        await captureBlockOptionsReview(page, {
            path: test.info().outputPath('popup-phone-raised-bed.png'),
        });

        expect(errors).toEqual([]);
        expect(backend.writes).toEqual([]);
        expect(backend.unhandledGets).toEqual([]);
    });

    test('a one-finger pan closes the pop-up and still pans', async ({
        mount,
        page,
    }) => {
        const errors = await setUp(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
        await mount(<BlockOptionsFixture viewport="phone" />);
        await waitForBlockOptionsFixture(page, { blockId: bush });

        await openBlockOptions(page, bush, 'touch');
        const camera = (await readBlockOptionsProbe(page))?.camera.position;
        const sky = { x: 180, y: 150 };
        expect(
            await page.evaluate(
                ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
                sky,
            ),
        ).toBe('CANVAS');
        const touch = await createBlockOptionsTouch(page);
        try {
            await touch.start(sky);
            await touch.dragTo({ x: sky.x + 90, y: sky.y + 60 }, 12);
            await touch.end();
        } finally {
            await touch.detach();
        }
        await expect.poll(() => readEditingMode(page)).toBeNull();
        await expect
            .poll(
                async () =>
                    (await readBlockOptionsProbe(page))?.camera.position,
            )
            .not.toEqual(camera);

        expect(errors).toEqual([]);
        expect(backend.writes).toEqual([]);
        expect(backend.unhandledGets).toEqual([]);
    });

    test('a touch tap on Pomakni lifts the block and shows the touch carry hint', async ({
        mount,
        page,
    }) => {
        const errors = await setUp(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
        await mount(<BlockOptionsFixture viewport="phone" />);
        await waitForBlockOptionsFixture(page, { blockId: bush });

        await openBlockOptions(page, bush, 'touch');
        const move = await tile(page, 'move').boundingBox();
        if (!move) {
            throw new Error('Pomakni is not on screen.');
        }
        const touch = await createBlockOptionsTouch(page);
        try {
            await touch.start({
                x: move.x + move.width / 2,
                y: move.y + move.height / 2,
            });
            await expect.poll(() => readEditingMode(page)).toBe('moving');
            await touch.end();
        } finally {
            await touch.detach();
        }
        await expect.poll(() => readEditingMode(page)).toBe('carry');
        const hint = page.locator('[data-block-move-carry-bubble]');
        await expect(hint).toHaveText(blockMoveCopy.carryTouch);
        await expect(popup(page)).toHaveCount(0);
        await expect(hint).toHaveCSS('opacity', '1');
        await captureBlockOptionsReview(page, {
            path: test.info().outputPath('carry-hint-touch.png'),
        });
        await page.keyboard.press('Escape');
        await expect.poll(() => readEditingMode(page)).toBeNull();

        expect(errors).toEqual([]);
        expect(backend.writes).toEqual([]);
        expect(backend.unhandledGets).toEqual([]);
    });

    test('the remove confirmation opens as a sheet on phones', async ({
        mount,
        page,
    }) => {
        const errors = await setUp(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
        await mount(<BlockOptionsFixture viewport="phone" />);
        await waitForBlockOptionsFixture(page, { blockId: bush });

        await openBlockOptions(page, bush, 'touch');
        await tile(page, 'remove').tap();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole('button', {
                name: blockRemoveCopy.recycle.confirm,
            }),
        ).toBeVisible();
        await captureBlockOptionsReview(page, {
            path: test.info().outputPath('remove-dialog-phone.png'),
        });
        await dialog
            .getByRole('button', { name: blockRemoveCopy.cancel })
            .tap();
        await expect(dialog).toHaveCount(0);

        expect(errors).toEqual([]);
        expect(backend.writes).toEqual([]);
        expect(backend.unhandledGets).toEqual([]);
    });
});
