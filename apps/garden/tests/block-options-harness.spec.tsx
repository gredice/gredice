import type { Page } from '@playwright/test';
import { BlockOptionsFixture } from '../../../packages/game/tests/BlockOptionsFixture';
import {
    blockOptionsFixtureBlockIds,
    blockOptionsFixtureGroundId,
    blockOptionsFixtureStageSizes,
    createBlockOptionsFixtureGarden,
    createBlockOptionsFixtureStacks,
} from '../../../packages/game/tests/blockOptionsFixtureData';
import {
    captureBlockOptionsReview,
    collectPageErrors,
    createBlockOptionsTouch,
    getBlockScreenPosition,
    installBlockOptionsBackend,
    readBlockOptionsProbe,
    waitForBlockOptionsFixture,
} from './blockOptionsTestSupport';
import { expect as baseExpect, test } from './webglComponentTest';

// Harness smoke checks for the block options browser specs (§14.3 #1): the
// fixture mounts the real garden scene with `BlockOptionsScene` and
// `BlockOptionsHud`, and `window.__blockOptionsProbe` opens and reads the
// editing state. Every write is stubbed and recorded by the harness backend.

test.setTimeout(90_000);
// As in block-options-expand.spec.tsx: one frame of the fixture garden can
// take a second or more on the CI software renderer, so assertions wait
// longer than the default 5 s.
const expect = baseExpect.configure({ timeout: 15_000 });

const { beachBall, bush, gardenBox } = blockOptionsFixtureBlockIds;

function readEditingMode(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.blockEditing?.mode ?? null,
    );
}

function openBlockOptions(page: Page, blockId: string, pointerType?: string) {
    return page.evaluate(
        ([id, pointer]) =>
            window.__blockOptionsProbe?.openBlockOptions(id, pointer) ?? null,
        [blockId, pointerType] as const,
    );
}

async function readHudObstacleCount(page: Page) {
    return (await readBlockOptionsProbe(page))?.hudObstacles.length ?? 0;
}

test('mounts the garden and opens the options pop-up state through the probe', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: beachBall });

    const before = await readBlockOptionsProbe(page);
    expect(before?.pendingEntityBlockIds).toEqual([]);
    expect(before?.blockEditing).toBeNull();
    expect(before?.hudObstacles).toEqual([]);
    expect(before?.garden?.id).toBe(createBlockOptionsFixtureGarden().id);
    expect(
        before?.garden?.blocks.find((block) => block.id === beachBall),
    ).toMatchObject({ name: 'BeachBall', x: 0, z: 0, index: 1 });

    const opened = await openBlockOptions(page, beachBall);
    expect(opened).toMatchObject({
        mode: 'menu',
        blockId: beachBall,
        blockName: 'BeachBall',
        pointerType: 'mouse',
    });
    await expect.poll(() => readEditingMode(page)).toBe('menu');

    // The stand-in HUD regions are measured while the pop-up is open: two
    // top-left, weather and sunflowers, chat, four controls and the items.
    await expect.poll(() => readHudObstacleCount(page)).toBe(10);
    const menu = await readBlockOptionsProbe(page);
    test.info().annotations.push({
        type: 'hud obstacles',
        description: JSON.stringify(menu?.hudObstacles),
    });
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas || !menu?.editingAnchor) {
        throw new Error('Expected the canvas and the editing anchor.');
    }
    expect(menu.editingAnchor.x).toBeGreaterThan(canvas.x);
    expect(menu.editingAnchor.x).toBeLessThan(canvas.x + canvas.width);
    expect(menu.editingAnchor.y).toBeGreaterThan(canvas.y);
    expect(menu.editingAnchor.y).toBeLessThan(canvas.y + canvas.height);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('harness-desktop-menu.png'),
    });

    // Escape closes the pop-up (`useBlockEditingAutoClose`) and the HUD is
    // no longer measured.
    await page.keyboard.press('Escape');
    await expect.poll(() => readEditingMode(page)).toBeNull();
    await expect.poll(() => readHudObstacleCount(page)).toBe(0);

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test('probe projects blocks, reports instanced outlines and follows the camera', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: gardenBox });

    // Hovering the instanced garden box mounts its outline target on its
    // cell, so the projection and the outline report agree.
    const boxPoint = await getBlockScreenPosition(page, gardenBox);
    await page.mouse.move(boxPoint.x - 40, boxPoint.y - 40);
    await page.mouse.move(boxPoint.x, boxPoint.y, { steps: 8 });
    await expect
        .poll(
            async () =>
                (await readBlockOptionsProbe(page))?.outline.instancedCells,
        )
        .toEqual([{ x: 3, z: 1 }]);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('harness-desktop-hover-outline.png'),
    });
    await page.mouse.move(8, 320, { steps: 8 });
    await expect
        .poll(
            async () =>
                (await readBlockOptionsProbe(page))?.outline.instancedCells,
        )
        .toEqual([]);

    // Arrow keys pan the camera; the probe reports the new position.
    const cameraBefore = (await readBlockOptionsProbe(page))?.camera;
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowRight');
    await expect
        .poll(async () => (await readBlockOptionsProbe(page))?.camera.position)
        .not.toEqual(cameraBefore?.position);
    expect(cameraBefore?.placementLocked).toBe(false);

    // A refetch reads the garden the harness backend serves.
    const stacks = createBlockOptionsFixtureStacks();
    const extraBlockId = 'harness-extra-bush';
    stacks
        .find((stack) => stack.position.x === -1 && stack.position.z === 1)
        ?.blocks.push({ id: extraBlockId, name: 'Bush', rotation: 0 });
    backend.setGarden(createBlockOptionsFixtureGarden({ stacks }));
    await page.evaluate(() => window.__blockOptionsProbe?.invalidateGarden());
    await expect
        .poll(async () =>
            (await readBlockOptionsProbe(page))?.garden?.blocks.find(
                (block) => block.id === extraBlockId,
            ),
        )
        .toMatchObject({ name: 'Bush', x: -1, z: 1, index: 1 });

    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
});

test.describe('touch', () => {
    test.use({ hasTouch: true });

    test('a CDP touch on the canvas outside the pop-up closes it', async ({
        mount,
        page,
    }) => {
        const errors = collectPageErrors(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
        await mount(<BlockOptionsFixture viewport="phone" />);
        await waitForBlockOptionsFixture(page, { blockId: bush });

        const canvas = await page.locator('canvas').boundingBox();
        expect(canvas).toMatchObject(blockOptionsFixtureStageSizes.phone);
        await openBlockOptions(page, bush, 'touch');
        await expect.poll(() => readEditingMode(page)).toBe('menu');
        await captureBlockOptionsReview(page, {
            path: test.info().outputPath('harness-phone-menu.png'),
        });

        // Sky above the garden, below the top HUD: only the canvas is there.
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
            await touch.end();
        } finally {
            await touch.detach();
        }
        await expect.poll(() => readEditingMode(page)).toBeNull();

        expect(errors).toEqual([]);
        expect(backend.writes).toEqual([]);
        expect(backend.unhandledGets).toEqual([]);
    });

    test('a CDP touch hold on instanced grass lifts it and the probe sees the pickup', async ({
        mount,
        page,
    }) => {
        const errors = collectPageErrors(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
        await mount(<BlockOptionsFixture viewport="phone" />);
        const groundId = blockOptionsFixtureGroundId(0, 3);
        await waitForBlockOptionsFixture(page, { blockId: groundId });

        const point = await getBlockScreenPosition(page, groundId, 'top');
        const touch = await createBlockOptionsTouch(page);
        try {
            await touch.start(point);
            // The hold lifts the block after about 320 ms.
            await expect
                .poll(
                    async () =>
                        (await readBlockOptionsProbe(page))?.pickupBlockId,
                    { timeout: 3000 },
                )
                .toBe(groundId);
            const lifted = await readBlockOptionsProbe(page);
            expect(lifted?.camera.placementLocked).toBe(true);
            await captureBlockOptionsReview(page, {
                path: test.info().outputPath('harness-phone-touch-hold.png'),
            });
            await touch.end();
        } finally {
            await touch.detach();
        }
        await expect
            .poll(
                async () => (await readBlockOptionsProbe(page))?.pickupBlockId,
            )
            .toBeNull();

        expect(errors).toEqual([]);
        // What a hold-release without moving sends today is WP-4's concern
        // (D1); record it for the report instead of asserting it here.
        test.info().annotations.push({
            type: 'hold-release writes',
            description: JSON.stringify(
                backend.writes.map(({ method, path, body }) => ({
                    method,
                    path,
                    body,
                })),
            ),
        });
    });
});

for (const variant of [
    { name: 'sandbox garden', sandbox: true, localSandbox: false },
    { name: 'local sandbox', sandbox: false, localSandbox: true },
]) {
    test(`mounts the ${variant.name} and opens the pop-up state`, async ({
        mount,
        page,
    }) => {
        const errors = collectPageErrors(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
        await mount(
            <BlockOptionsFixture
                sandbox={variant.sandbox}
                localSandbox={variant.localSandbox}
            />,
        );
        await waitForBlockOptionsFixture(page, { blockId: beachBall });

        const snapshot = await readBlockOptionsProbe(page);
        expect(snapshot?.garden?.isSandbox).toBe(true);
        if (variant.localSandbox) {
            expect(snapshot?.garden?.id).toBe(0);
        }
        // Sandbox gardens show no sunflower balance, as in the game HUD.
        await expect(
            page.locator('[data-block-options-fixture-balance]'),
        ).toHaveCount(0);

        await openBlockOptions(page, beachBall);
        await expect.poll(() => readEditingMode(page)).toBe('menu');
        await captureBlockOptionsReview(page, {
            path: test
                .info()
                .outputPath(
                    `harness-${variant.localSandbox ? 'local-sandbox' : 'sandbox'}-menu.png`,
                ),
        });
        await page.evaluate(() =>
            window.__blockOptionsProbe?.closeBlockEditing(),
        );
        await expect.poll(() => readEditingMode(page)).toBeNull();

        expect(errors).toEqual([]);
        expect(backend.writes).toEqual([]);
        expect(backend.unhandledGets).toEqual([]);
    });
}
