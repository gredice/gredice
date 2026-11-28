import type { Locator, Page } from '@playwright/test';
import { BlockOptionsFixture } from '../../../packages/game/tests/BlockOptionsFixture';
import {
    blockOptionsFixtureBlockIds,
    blockOptionsFixtureGroundId,
    blockOptionsFixtureNightTime,
    blockOptionsFixtureStageSizes,
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

// Expand scene preview (spec §7.4, §7.5, §14.3 #21–#24): the see-through
// copies, the cell plates, the corner handle and its pointer, tap and
// keyboard input. Expand is started through the probe (as the pop-up's
// Proširi does) or through the pop-up itself; every write is stubbed and
// none is expected, because nothing here confirms the batch.

test.setTimeout(120_000);
// As in block-options-expand.spec.tsx: one frame of the fixture garden can
// take a second or more on the CI software renderer, so assertions wait
// longer than the default 5 s.
const expect = baseExpect.configure({ timeout: 15_000 });

const { beachBall, bush, tulip } = blockOptionsFixtureBlockIds;
/** `Block_Grass` at (1, −4), beside the 3 × 2 hole at x 2–4, z −4…−3. */
const terrainSource = blockOptionsFixtureGroundId(1, -4);
/** The top of a `Block_Grass` on bare ground (height 0.4). */
const grassTop = 0.4;
/** The top of a `BeachBall` (0.32) on the ground grass. */
const beachBallTop = grassTop + 0.32;
const handleSelector = '[data-block-expand-handle]';
const ghostPrefix = 'BlockExpand:Ghost:';
/** The see-through meshes of the rim a terrain block's copies share. */
const ghostRimPrefix = 'BlockExpand:GhostRim:';

type Point = { x: number; y: number };
type Cell = { x: number; z: number };

async function readExpand(page: Page) {
    const editing = await page.evaluate(
        () => window.__blockOptionsProbe?.blockEditing ?? null,
    );
    if (editing?.mode !== 'expand') {
        throw new Error(`Expected Expand, got ${editing?.mode ?? 'none'}.`);
    }
    return editing;
}

async function readCorner(page: Page): Promise<Cell> {
    return (await readExpand(page)).corner;
}

async function startExpand(page: Page, blockId: string) {
    const result = await page.evaluate(
        (id) => window.__blockOptionsProbe?.startBlockExpand(id) ?? null,
        blockId,
    );
    expect(result).toEqual({ ok: true });
    const handle = page.locator(handleSelector);
    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute(
        'data-block-expand-ghosts',
        /parts|fallback/,
    );
    return handle;
}

async function setCorner(page: Page, cell: Cell) {
    await page.evaluate(
        ({ x, z }) => window.__blockOptionsProbe?.setBlockExpandCorner(x, z),
        cell,
    );
}

async function projectWorld(page: Page, x: number, y: number, z: number) {
    const point = await page.evaluate(
        ([px, py, pz]) =>
            window.__blockOptionsProbe?.projectWorld(px, py, pz) ?? null,
        [x, y, z] as const,
    );
    if (!point) {
        throw new Error('The probe could not project the point.');
    }
    return point;
}

async function centerOf(locator: Locator): Promise<Point> {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('Expected a visible element.');
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragHandleWithMouse(page: Page, handle: Locator, to: Point) {
    const from = await centerOf(handle);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 14 });
    await page.mouse.up();
}

function readGhostMeshCount(page: Page, prefix = ghostPrefix) {
    return page.evaluate(
        (name) => window.__blockOptionsProbe?.countObjects(name) ?? 0,
        prefix,
    );
}

/** The shared rim of terrain copies: its meshes and pieces. */
async function readGhostRim(handle: Locator) {
    return {
        parts: await readHandleNumber(
            handle,
            'data-block-expand-ghost-rim-parts',
        ),
        pieces: await readHandleNumber(
            handle,
            'data-block-expand-ghost-rim-pieces',
        ),
    };
}

async function readHandleNumber(handle: Locator, attribute: string) {
    return Number(await handle.getAttribute(attribute));
}

function isHandleFocused(page: Page) {
    return page.evaluate(
        () =>
            document.activeElement?.hasAttribute('data-block-expand-handle') ??
            false,
    );
}

/**
 * Waits until the camera has turned to `worldRotation` quarter turns (the
 * azimuth `GameCameraRig` uses) and stopped moving.
 */
async function waitForCameraRotation(page: Page, worldRotation: number) {
    const expected =
        ((((worldRotation * Math.PI) / 2 + (5 * Math.PI) / 4) % (2 * Math.PI)) +
            2 * Math.PI) %
        (2 * Math.PI);
    let previous = '';
    await expect
        .poll(
            async () => {
                const camera = (await readBlockOptionsProbe(page))?.camera;
                if (!camera?.target) {
                    return false;
                }
                const [x, , z] = camera.position;
                const [targetX, , targetZ] = camera.target;
                const azimuth =
                    (Math.atan2(x - targetX, z - targetZ) + 2 * Math.PI) %
                    (2 * Math.PI);
                const turned =
                    Math.abs(
                        Math.atan2(
                            Math.sin(azimuth - expected),
                            Math.cos(azimuth - expected),
                        ),
                    ) < 0.01;
                const current = JSON.stringify(camera.position);
                const settled = turned && current === previous;
                previous = current;
                return settled;
            },
            { intervals: [150], timeout: 10_000 },
        )
        .toBe(true);
}

/** Whether a client point is far enough from the canvas edges to not autopan. */
async function expectAwayFromCanvasEdges(page: Page, point: Point) {
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) {
        throw new Error('Expected the canvas.');
    }
    const margin = 100;
    expect(point.x).toBeGreaterThan(canvas.x + margin);
    expect(point.x).toBeLessThan(canvas.x + canvas.width - margin);
    expect(point.y).toBeGreaterThan(canvas.y + margin);
    expect(point.y).toBeLessThan(canvas.y + canvas.height - margin);
}

function expectCleanRun(
    errors: string[],
    backend: Awaited<ReturnType<typeof installBlockOptionsBackend>>,
) {
    expect(errors).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.unhandledGets).toEqual([]);
}

test('#21 terrain: dragging the handle 3 cells along x and 2 along z marks 4 × 3 with plates on the empty cells', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSource });

    const handle = await startExpand(page, terrainSource);
    expect(await readExpand(page)).toMatchObject({
        blockName: 'Block_Grass',
        source: { x: 1, z: -4 },
        corner: { x: 1, z: -4 },
        sourceBaseHeight: 0,
        maxSide: 10,
        pending: false,
    });
    await expect(handle).toHaveAttribute(
        'aria-label',
        'Ručka za proširivanje, 1 × 1',
    );
    await expect(handle).toHaveAttribute('data-block-expand-count', '0');
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-terrain-start.png'),
    });

    // Drag the knob from the source's top to the top of cell (4, −2).
    const target = await projectWorld(page, 4, grassTop, -2);
    await expectAwayFromCanvasEdges(page, target);
    await dragHandleWithMouse(page, handle, target);
    await expect.poll(() => readCorner(page)).toEqual({ x: 4, z: -2 });
    await expect(handle).toHaveAttribute(
        'aria-label',
        'Ručka za proširivanje, 4 × 3',
    );
    // The Expand bar counts the same plan.
    await expect(
        page.getByRole('region', { name: 'Proširivanje bloka' }),
    ).toContainText('Područje 4 × 3');

    // Only the six cells of the hole (x 2–4, z −4…−3) get a copy and a
    // plate; the grass cells around them are skipped.
    await expect(handle).toHaveAttribute('data-block-expand-count', '6');
    await expect(handle).toHaveAttribute('data-block-expand-skipped', '5');
    expect(
        await page.evaluate(
            () =>
                window.__blockOptionsProbe?.countObjects(
                    'BlockExpand:Plates',
                ) ?? 0,
        ),
    ).toBe(1);

    // Ghost copies are drawn from the template's parts, not as a fallback.
    await expect(handle).toHaveAttribute('data-block-expand-ghosts', 'parts');
    const partCount = await readHandleNumber(
        handle,
        'data-block-expand-ghost-parts',
    );
    expect(partCount).toBeGreaterThan(0);
    expect(await readGhostMeshCount(page)).toBe(partCount);
    // The copies fill a hole at the lawn's corner, so once placed they merge
    // into the lawn: no piece between copies or towards the grass, only the
    // lawn's outer edge where the hole meets it (three edges on its −z side,
    // two on its +x side and the corner between them).
    await expect
        .poll(() => readGhostRim(handle))
        .toEqual({ parts: 4, pieces: 6 });
    expect(await readGhostMeshCount(page, ghostRimPrefix)).toBe(4);

    // A pointer start and a mouse drag leave focus where it was.
    expect(await isHandleFocused(page)).toBe(false);
    expect(
        await page.evaluate(() => document.activeElement === document.body),
    ).toBe(true);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-terrain-4x3.png'),
    });

    expectCleanRun(errors, backend);
});

test('#22 Block_Grass 10 × 10 draws one instanced mesh per template part, not one per copy', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSource });

    const handle = await startExpand(page, terrainSource);
    await setCorner(page, { x: 2, z: -4 });
    await expect(handle).toHaveAttribute('data-block-expand-count', '1');
    await expect(handle).toHaveAttribute('data-block-expand-ghosts', 'parts');
    const partCount = await readHandleNumber(
        handle,
        'data-block-expand-ghost-parts',
    );
    expect(partCount).toBeGreaterThan(0);
    await expect.poll(() => readGhostMeshCount(page)).toBe(partCount);

    // 10 × 10 from (1, −4) to (10, 5): every empty cell gets a copy. The
    // six cells of the hole, four cells beyond the garden's z edge at x 1–4
    // and the 6 × 10 cells beyond its x edge make 70.
    await setCorner(page, { x: 10, z: 5 });
    await expect(handle).toHaveAttribute(
        'aria-label',
        'Ručka za proširivanje, 10 × 10',
    );
    await expect(handle).toHaveAttribute('data-block-expand-count', '70');
    await expect(handle).toHaveAttribute('data-block-expand-skipped', '29');
    expect(await readGhostMeshCount(page)).toBe(partCount);
    await expect(handle).toHaveAttribute(
        'data-block-expand-ghost-parts',
        String(partCount),
    );
    // The copies beyond the garden's edges share one rim: only the outer
    // edge of the new area gets pieces (rimmed alone, each copy would need
    // eight), and every rim part is one mesh, however many pieces it draws.
    await expect
        .poll(async () => (await readGhostRim(handle)).parts)
        .toBeGreaterThan(0);
    const rim = await readGhostRim(handle);
    expect(rim.pieces).toBeGreaterThan(0);
    expect(rim.pieces).toBeLessThan(70);
    expect(await readGhostMeshCount(page, ghostRimPrefix)).toBe(rim.parts);

    // The corner is clamped to 10 per side.
    await setCorner(page, { x: 14, z: 9 });
    expect(await readCorner(page)).toEqual({ x: 10, z: 5 });
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-terrain-10x10.png'),
    });

    // Other kinds of blocks draw real ghosts too, never the fallback: an
    // instanced bush, an instanced flower and a per-entity beach ball.
    for (const [blockId, corner] of [
        [bush, { x: -4, z: 1 }],
        [tulip, { x: 0, z: -3 }],
        [beachBall, { x: 1, z: 1 }],
    ] as const) {
        await page.evaluate(() =>
            window.__blockOptionsProbe?.closeBlockEditing(),
        );
        await expect(page.locator(handleSelector)).toHaveCount(0);
        const next = await startExpand(page, blockId);
        await setCorner(page, corner);
        await expect(next).toHaveAttribute('data-block-expand-ghosts', 'parts');
        const parts = await readHandleNumber(
            next,
            'data-block-expand-ghost-parts',
        );
        expect(parts, blockId).toBeGreaterThan(0);
        await expect
            .poll(() => readGhostMeshCount(page), { message: blockId })
            .toBe(parts);
        expect(
            await readHandleNumber(next, 'data-block-expand-count'),
            blockId,
        ).toBeGreaterThan(0);
        await captureBlockOptionsReview(page, {
            path: test.info().outputPath(`expand-ghosts-${blockId}.png`),
        });
    }

    expectCleanRun(errors, backend);
});

test('#23 a non-instanced block clamps the corner at 5 × 5 and shows the cap', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: beachBall });

    const handle = await startExpand(page, beachBall);
    expect(await readExpand(page)).toMatchObject({
        blockName: 'BeachBall',
        source: { x: 0, z: 0 },
        maxSide: 5,
    });

    // Drag the knob to cell (5, 0): one cell past the cap along x.
    const capHint = page.locator('[data-block-expand-cap-hint]');
    const from = await centerOf(handle);
    const beyond = await projectWorld(page, 5, beachBallTop, 0);
    await expectAwayFromCanvasEdges(page, beyond);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(beyond.x, beyond.y, { steps: 14 });
    await expect.poll(() => readCorner(page)).toEqual({ x: 4, z: 0 });
    await expect(handle).toHaveAttribute(
        'aria-label',
        'Ručka za proširivanje, 5 × 1',
    );
    await expect(capHint).toHaveText('Najviše 5 × 5 polja odjednom.');
    await expect(handle).toHaveAttribute('data-block-expand-cap', 'true');
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-beach-ball-cap-drag.png'),
    });

    // Back within the cap the hint goes away at once.
    const within = await projectWorld(page, 3, beachBallTop, 0);
    await page.mouse.move(within.x, within.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => readCorner(page)).toEqual({ x: 3, z: 0 });
    await expect(capHint).toHaveCount(0);

    // A 5 × 5 is the most: the snowman and the garden box are skipped.
    await setCorner(page, { x: 9, z: 9 });
    expect(await readCorner(page)).toEqual({ x: 4, z: 4 });
    await expect(handle).toHaveAttribute(
        'aria-label',
        'Ručka za proširivanje, 5 × 5',
    );
    await expect(handle).toHaveAttribute('data-block-expand-count', '22');

    // Arrow keys past the cap show it too (ArrowLeft is +x at rotation 0).
    await handle.focus();
    await page.keyboard.press('ArrowLeft');
    expect(await readCorner(page)).toEqual({ x: 4, z: 4 });
    await expect(capHint).toHaveText('Najviše 5 × 5 polja odjednom.');
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-beach-ball-5x5-cap.png'),
    });

    expectCleanRun(errors, backend);
});

test('#24 keyboard Proširi focuses the handle and the arrows follow the screen after Q and W', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSource });

    // A mouse click on Proširi starts Expand without moving focus to the
    // handle.
    await page.evaluate(
        (id) => window.__blockOptionsProbe?.openBlockOptions(id),
        terrainSource,
    );
    const expandTile = page.getByRole('button', { name: 'Proširi' });
    await expect(expandTile).toBeVisible();
    // The pop-up ignores activations within 300 ms of opening.
    await page.waitForTimeout(400);
    await expandTile.click();
    const handle = page.locator(handleSelector);
    await expect(handle).toBeVisible();
    expect(await isHandleFocused(page)).toBe(false);
    await page.keyboard.press('Escape');
    await expect(handle).toHaveCount(0);

    // The keyboard: Tab into the pop-up's toolbar, Enter on Proširi.
    await page.evaluate(
        (id) => window.__blockOptionsProbe?.openBlockOptions(id, 'touch'),
        terrainSource,
    );
    await expect(expandTile).toBeVisible();
    await page.waitForTimeout(400);
    for (let presses = 0; presses < 12; presses++) {
        await page.keyboard.press('Tab');
        if (
            await expandTile.evaluate(
                (element) => element === document.activeElement,
            )
        ) {
            break;
        }
    }
    await expect(expandTile).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(handle).toBeVisible();
    await expect.poll(() => isHandleFocused(page)).toBe(true);
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-keyboard-focus.png'),
    });

    // Each arrow moves the corner one cell the way it points on screen
    // (turned 45° clockwise): up-right, down-right, down-left, up-left. The
    // world rotations come from Q and W pressed while the handle has focus.
    const screenSigns: Record<string, readonly [number, number]> = {
        ArrowUp: [1, -1],
        ArrowRight: [1, 1],
        ArrowDown: [-1, 1],
        ArrowLeft: [-1, -1],
    };
    const rotations: { key: string | null; label: string; turns: number }[] = [
        { key: null, label: 'rotation 0', turns: 0 },
        { key: 'q', label: 'after Q', turns: 1 },
        { key: 'q', label: 'after Q Q', turns: 2 },
        { key: 'q', label: 'after Q Q Q', turns: 3 },
        { key: 'w', label: 'after Q Q Q W', turns: 2 },
        { key: 'w', label: 'after Q Q Q W W', turns: 1 },
        { key: 'w', label: 'after Q Q Q W W W', turns: 0 },
        { key: 'w', label: 'after Q Q Q W W W W', turns: -1 },
    ];
    for (const { key, label, turns } of rotations) {
        if (key) {
            await page.keyboard.press(key);
        }
        await waitForCameraRotation(page, turns);
        await expect(handle, label).toBeFocused();
        for (const [arrow, [signX, signY]] of Object.entries(screenSigns)) {
            const before = await readCorner(page);
            await page.keyboard.press(arrow);
            const after = await readCorner(page);
            expect(
                Math.abs(after.x - before.x) + Math.abs(after.z - before.z),
                `${label}, ${arrow}`,
            ).toBe(1);
            const from = await projectWorld(page, before.x, grassTop, before.z);
            const to = await projectWorld(page, after.x, grassTop, after.z);
            expect(Math.sign(to.x - from.x), `${label}, ${arrow} x`).toBe(
                signX,
            );
            expect(Math.sign(to.y - from.y), `${label}, ${arrow} y`).toBe(
                signY,
            );
        }
        // The four arrows bring the corner back to the source.
        expect(await readCorner(page), label).toEqual({ x: 1, z: -4 });
    }
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-keyboard-rotated.png'),
    });

    // Escape on the handle cancels Expand.
    await page.keyboard.press('Escape');
    await expect(handle).toHaveCount(0);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__blockOptionsProbe?.blockEditing ?? null,
            ),
        )
        .toBeNull();

    expectCleanRun(errors, backend);
});

test('a tap on the canvas moves the corner; a pan does not', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSource });

    const handle = await startExpand(page, terrainSource);
    // An empty cell beyond the garden: nothing stands in front of it.
    const tap = await projectWorld(page, 6, 0, -4);
    await page.mouse.click(tap.x, tap.y);
    await expect.poll(() => readCorner(page)).toEqual({ x: 6, z: -4 });
    await expect(handle).toHaveAttribute(
        'aria-label',
        'Ručka za proširivanje, 6 × 1',
    );
    await expect(handle).toHaveAttribute('data-block-expand-count', '5');

    // A one-finger pan (here a mouse drag on the canvas) moves the camera,
    // keeps Expand open and leaves the corner alone.
    const cameraBefore = (await readBlockOptionsProbe(page))?.camera.position;
    const panFrom = await projectWorld(page, 7, 0, 0);
    await page.mouse.move(panFrom.x, panFrom.y);
    await page.mouse.down();
    await page.mouse.move(panFrom.x - 120, panFrom.y + 40, { steps: 10 });
    await page.mouse.up();
    await expect
        .poll(async () => (await readBlockOptionsProbe(page))?.camera.position)
        .not.toEqual(cameraBefore);
    expect(await readCorner(page)).toEqual({ x: 6, z: -4 });
    expect((await readExpand(page)).mode).toBe('expand');

    expectCleanRun(errors, backend);
});

test('holding the knob at the canvas edge pans the camera and keeps stretching', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSource });

    const handle = await startExpand(page, terrainSource);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) {
        throw new Error('Expected the canvas.');
    }
    // Near the left edge, in the sky beyond the garden's +x side.
    const edge = { x: canvas.x + 30, y: canvas.y + 200 };
    const from = await centerOf(handle);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(edge.x, edge.y, { steps: 10 });
    const cameraAtEdge = (await readBlockOptionsProbe(page))?.camera.position;
    const cornerAtEdge = await readCorner(page);
    // Held at the edge, the camera pans and the rectangle keeps growing
    // towards the edge (+x here). The pan advances once per drawn frame, and
    // a software-rendered frame on CI can take longer than a fixed wait, so
    // wait for both while the button is still down.
    await expect
        .poll(async () => (await readBlockOptionsProbe(page))?.camera.position)
        .not.toEqual(cameraAtEdge);
    await expect
        .poll(async () => (await readCorner(page)).x)
        .toBeGreaterThan(cornerAtEdge.x);
    const cornerAfterHold = await readCorner(page);
    await page.mouse.up();

    // The rectangle stays capped.
    expect(cornerAfterHold.x - 1).toBeLessThanOrEqual(9);
    // Released, the camera stops: once the frame in flight has drawn, two
    // reads 400 ms apart agree.
    let cameraReleased = '';
    await expect
        .poll(
            async () => {
                const camera = JSON.stringify(
                    (await readBlockOptionsProbe(page))?.camera.position,
                );
                const settled = camera === cameraReleased;
                cameraReleased = camera;
                return settled;
            },
            { intervals: [400] },
        )
        .toBe(true);

    expectCleanRun(errors, backend);
});

test('edge blocks: ramp and stairs copies wear the rim of a placed block', async ({
    mount,
    page,
}) => {
    // A grass ramp and stone stairs, each alone on bare ground beyond the
    // garden's +x edge, so the placed source and its copies are rimmed the
    // same way: all round.
    const ramp = 'edge-ramp';
    const stairs = 'edge-stairs';
    const stacks = [
        ...createBlockOptionsFixtureStacks(),
        {
            position: { x: 6, y: 0, z: -1 },
            blocks: [{ id: ramp, name: 'Block_Grass_Angle', rotation: 1 }],
        },
        {
            position: { x: 6, y: 0, z: 2 },
            blocks: [{ id: stairs, name: 'Block_Stone_Stairs', rotation: 1 }],
        },
    ];
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page, {
        garden: createBlockOptionsFixtureGarden({ stacks }),
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture stacks={stacks} />);
    await waitForBlockOptionsFixture(page, { blockId: ramp });

    for (const [blockId, corner] of [
        [ramp, { x: 7, z: 0 }],
        [stairs, { x: 7, z: 3 }],
    ] as const) {
        await page.evaluate(() =>
            window.__blockOptionsProbe?.closeBlockEditing(),
        );
        await expect(page.locator(handleSelector)).toHaveCount(0);
        const handle = await startExpand(page, blockId);
        await setCorner(page, corner);
        // The source plus three copies on the bare ground around it.
        await expect(handle).toHaveAttribute('data-block-expand-count', '3');
        await expect(handle).toHaveAttribute(
            'data-block-expand-ghosts',
            'parts',
        );
        // The block itself, and the rim the copies share: at least its lip
        // and body pieces.
        const parts = await readHandleNumber(
            handle,
            'data-block-expand-ghost-parts',
        );
        expect(parts, blockId).toBeGreaterThanOrEqual(1);
        await expect
            .poll(() => readGhostMeshCount(page), { message: blockId })
            .toBe(parts);
        await expect
            .poll(async () => (await readGhostRim(handle)).parts, {
                message: blockId,
            })
            .toBeGreaterThanOrEqual(2);
        const rim = await readGhostRim(handle);
        expect(rim.pieces, blockId).toBeGreaterThan(0);
        expect(await readGhostMeshCount(page, ghostRimPrefix), blockId).toBe(
            rim.parts,
        );

        const source = (await readExpand(page)).source;
        const points: Point[] = [];
        for (const x of [source.x - 0.5, corner.x + 0.5]) {
            for (const z of [source.z - 0.5, corner.z + 0.5]) {
                points.push(await projectWorld(page, x, 0, z));
                points.push(await projectWorld(page, x, 0.6, z));
            }
        }
        const margin = 60;
        const left = Math.max(0, Math.min(...points.map((p) => p.x)) - margin);
        const top = Math.max(0, Math.min(...points.map((p) => p.y)) - margin);
        const right = Math.max(...points.map((p) => p.x)) + margin;
        const bottom = Math.max(...points.map((p) => p.y)) + margin;
        await captureBlockOptionsReview(page, {
            path: test.info().outputPath(`expand-edge-${blockId}.png`),
            clip: {
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
            },
        });
    }

    expectCleanRun(errors, backend);
});

test('terrain copies share one rim: a 3 × 3 of sand gets a single outer lip', async ({
    mount,
    page,
}) => {
    // A sand block on bare ground in the middle of the view: the lawn's
    // cells x and z −2…2 are cleared, so the 3 × 3 from (−1, −1) to (1, 1)
    // has bare ground all round it.
    const sand = 'island-sand';
    const stacks = [
        ...createBlockOptionsFixtureStacks().filter(
            ({ position }) =>
                Math.abs(position.x) > 2 || Math.abs(position.z) > 2,
        ),
        {
            position: { x: -1, y: 0, z: -1 },
            blocks: [{ id: sand, name: 'Block_Sand', rotation: 0 }],
        },
    ];
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page, {
        garden: createBlockOptionsFixtureGarden({ stacks }),
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture stacks={stacks} />);
    await waitForBlockOptionsFixture(page, { blockId: sand });

    const handle = await startExpand(page, sand);
    await setCorner(page, { x: 1, z: 1 });
    await expect(handle).toHaveAttribute('data-block-expand-count', '8');
    await expect(handle).toHaveAttribute('data-block-expand-ghosts', 'parts');
    // The copies' share of the 3 × 3's outer edge: ten edges and three
    // corners (the source holds the fourth corner and two edges). Rimmed
    // one by one, the eight copies would wear 64 pieces.
    await expect
        .poll(() => readGhostRim(handle))
        .toEqual({ parts: 4, pieces: 13 });
    expect(await readGhostMeshCount(page, ghostRimPrefix)).toBe(4);
    // The block itself is one part drawn at every copy cell.
    await expect(handle).toHaveAttribute('data-block-expand-ghost-parts', '1');
    expect(await readGhostMeshCount(page)).toBe(1);

    const points: Point[] = [];
    for (const x of [-1.5, 1.5]) {
        for (const z of [-1.5, 1.5]) {
            points.push(await projectWorld(page, x, 0, z));
            points.push(await projectWorld(page, x, 0.6, z));
        }
    }
    const viewport = blockOptionsFixtureStageSizes.desktop;
    const margin = 60;
    const left = Math.max(0, Math.min(...points.map((p) => p.x)) - margin);
    const top = Math.max(0, Math.min(...points.map((p) => p.y)) - margin);
    const right = Math.min(
        viewport.width,
        Math.max(...points.map((p) => p.x)) + margin,
    );
    const bottom = Math.min(
        viewport.height,
        Math.max(...points.map((p) => p.y)) + margin,
    );
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-sand-3x3.png'),
        clip: { x: left, y: top, width: right - left, height: bottom - top },
    });

    expectCleanRun(errors, backend);
});

test('fence and water copies take the shape they will have once placed', async ({
    mount,
    page,
}) => {
    // A fence and a water block on bare ground: the lawn's cells x and z
    // −2…2 are cleared. The fence row runs along z = 2, the 4 × 4 of water
    // fills x −1…2, z −2…1 below it.
    const fence = 'row-fence';
    const water = 'pond-water';
    const stacks = [
        ...createBlockOptionsFixtureStacks().filter(
            ({ position }) =>
                Math.abs(position.x) > 2 || Math.abs(position.z) > 2,
        ),
        {
            position: { x: -2, y: 0, z: 2 },
            blocks: [{ id: fence, name: 'Fence', rotation: 0 }],
        },
        {
            position: { x: -1, y: 0, z: -2 },
            blocks: [{ id: water, name: 'Block_Water', rotation: 0 }],
        },
    ];
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page, {
        garden: createBlockOptionsFixtureGarden({ stacks }),
    });
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture stacks={stacks} />);
    await waitForBlockOptionsFixture(page, { blockId: fence });

    async function screenshotArea(name: string, from: Cell, to: Cell) {
        const points: Point[] = [];
        for (const x of [from.x - 0.5, to.x + 0.5]) {
            for (const z of [from.z - 0.5, to.z + 0.5]) {
                points.push(await projectWorld(page, x, 0, z));
                points.push(await projectWorld(page, x, 1.2, z));
            }
        }
        const viewport = blockOptionsFixtureStageSizes.desktop;
        const margin = 60;
        const left = Math.max(0, Math.min(...points.map((p) => p.x)) - margin);
        const top = Math.max(0, Math.min(...points.map((p) => p.y)) - margin);
        const right = Math.min(
            viewport.width,
            Math.max(...points.map((p) => p.x)) + margin,
        );
        const bottom = Math.min(
            viewport.height,
            Math.max(...points.map((p) => p.y)) + margin,
        );
        await captureBlockOptionsReview(page, {
            path: test.info().outputPath(name),
            clip: {
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
            },
        });
    }

    // The fence row: three middles and an end. Drawn as lone fences they
    // would be four posts; placed, they join into one fence with rails.
    const fenceHandle = await startExpand(page, fence);
    await expect(fenceHandle).toHaveAttribute(
        'data-block-expand-ghost-variants',
        '1',
    );
    await setCorner(page, { x: 2, z: 2 });
    await expect(fenceHandle).toHaveAttribute('data-block-expand-count', '4');
    await expect(fenceHandle).toHaveAttribute(
        'data-block-expand-ghost-variants',
        '2',
    );
    await expect(fenceHandle).toHaveAttribute(
        'data-block-expand-ghosts',
        'parts',
    );
    const fenceParts = await readHandleNumber(
        fenceHandle,
        'data-block-expand-ghost-parts',
    );
    expect(fenceParts).toBeGreaterThanOrEqual(2);
    await expect.poll(() => readGhostMeshCount(page)).toBe(fenceParts);
    await screenshotArea(
        'expand-fence-row.png',
        { x: -2, z: 2 },
        { x: 2, z: 2 },
    );

    // The 4 × 4 of water: one slab with an open rim on its outer edge only.
    // Its 15 copies take eight shapes (three corners, four sides and the
    // middle), each one template drawn on every cell of that shape.
    await page.evaluate(() => window.__blockOptionsProbe?.closeBlockEditing());
    await expect(page.locator(handleSelector)).toHaveCount(0);
    const waterHandle = await startExpand(page, water);
    await setCorner(page, { x: 2, z: 1 });
    await expect(waterHandle).toHaveAttribute('data-block-expand-count', '15');
    await expect(waterHandle).toHaveAttribute(
        'data-block-expand-ghost-variants',
        '8',
    );
    await expect(waterHandle).toHaveAttribute(
        'data-block-expand-ghosts',
        'parts',
    );
    const waterParts = await readHandleNumber(
        waterHandle,
        'data-block-expand-ghost-parts',
    );
    expect(waterParts).toBe(8);
    await expect.poll(() => readGhostMeshCount(page)).toBe(waterParts);
    await screenshotArea(
        'expand-water-4x4.png',
        { x: -1, z: -2 },
        { x: 2, z: 1 },
    );

    expectCleanRun(errors, backend);
});

test.describe('touch', () => {
    test.use({ hasTouch: true });

    test('a CDP touch drag of the handle stretches the rectangle on a phone', async ({
        mount,
        page,
    }) => {
        const errors = collectPageErrors(page);
        const backend = await installBlockOptionsBackend(page);
        await page.setViewportSize(blockOptionsFixtureStageSizes.phone);
        await mount(<BlockOptionsFixture viewport="phone" />);
        await waitForBlockOptionsFixture(page, { blockId: bush });

        const handle = await startExpand(page, bush);
        const box = await handle.boundingBox();
        // The hit area is at least 44 × 44.
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);

        // A finger that moves less than 12 px does not drag.
        const from = await centerOf(handle);
        const touch = await createBlockOptionsTouch(page);
        try {
            await touch.start(from);
            await touch.dragTo({ x: from.x + 8, y: from.y + 4 }, 3);
            await touch.end();
            expect(await readCorner(page)).toEqual({ x: -2, z: 0 });

            // Bush top: grass (0.4) plus the bush (0.8). The target stays
            // clear of the canvas edges, where the camera would autopan.
            const target = await projectWorld(page, -3, grassTop + 0.8, -1);
            await expectAwayFromCanvasEdges(page, target);
            await touch.start(from);
            await touch.dragTo(target, 12);
            await touch.end();
        } finally {
            await touch.detach();
        }
        await expect.poll(() => readCorner(page)).toEqual({ x: -3, z: -1 });
        await expect(handle).toHaveAttribute(
            'aria-label',
            'Ručka za proširivanje, 2 × 2',
        );
        await expect(handle).toHaveAttribute('data-block-expand-count', '3');
        expect(await isHandleFocused(page)).toBe(false);
        await captureBlockOptionsReview(page, {
            path: test.info().outputPath('expand-phone-touch-drag.png'),
        });

        expectCleanRun(errors, backend);
    });
});

test('the preview draws with the fixture at night time', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture time={blockOptionsFixtureNightTime} />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSource });

    const handle = await startExpand(page, terrainSource);
    await setCorner(page, { x: 4, z: -2 });
    await expect(handle).toHaveAttribute('data-block-expand-count', '6');
    await expect(handle).toHaveAttribute('data-block-expand-ghosts', 'parts');
    await captureBlockOptionsReview(page, {
        path: test.info().outputPath('expand-terrain-night.png'),
    });

    expectCleanRun(errors, backend);
});

/** The scene's render leases (owner × count) and fixed-step owners. */
function readRuntimeLeases(page: Page) {
    return page.evaluate(() => {
        const runtime = window.__grediceGameProfile?.runtimeFrameLoop;
        if (!runtime) {
            return null;
        }
        return {
            render: runtime.renderLeaseSummaries
                .map((summary) => `${summary.owner}×${summary.leaseCount}`)
                .sort(),
            fixedSteps: [...runtime.fixedStepOwners].sort(),
        };
    });
}

function readRenderResources(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.renderResources() ?? null,
    );
}

/**
 * Asks for frames until `count` more have been drawn. A fixed wait is not
 * enough on the CI software renderer, where one frame of the fixture garden
 * can take longer than the wait, so a corner could be skipped undrawn.
 */
async function waitForDrawnFrames(page: Page, count = 2) {
    const start = await page.evaluate(
        () => window.__blockOptionsProbe?.frames ?? 0,
    );
    await expect
        .poll(async () => {
            await page.evaluate(() =>
                window.__blockOptionsProbe?.requestRender(),
            );
            return page.evaluate(() => window.__blockOptionsProbe?.frames ?? 0);
        })
        .toBeGreaterThanOrEqual(start + count);
}

/** Moves the corner through `corners`, drawing frames at each. */
async function visitCorners(page: Page, corners: readonly Cell[]) {
    for (const corner of corners) {
        await setCorner(page, corner);
        await expect.poll(() => readCorner(page)).toEqual(corner);
        await waitForDrawnFrames(page);
        await page.waitForTimeout(400);
    }
}

function readRenderResourceIds(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.renderResourceIds() ?? null,
    );
}

type RenderResourceIds = NonNullable<
    Awaited<ReturnType<typeof readRenderResourceIds>>
>;

/**
 * What changed since `settled`: programs linked or released, and geometry
 * or material ids the Expand preview's meshes use that it did not use then
 * (a mesh left out at one corner may come back; a rebuilt one has new ids).
 */
function diffRenderResourceIds(
    settled: RenderResourceIds,
    current: RenderResourceIds | null,
) {
    const added = (from: readonly unknown[], to: readonly unknown[]) =>
        to.filter((id) => !from.includes(id));
    return {
        programsLinked: added(settled.programs, current?.programs ?? []),
        programsReleased: added(current?.programs ?? [], settled.programs),
        newGeometries: added(
            settled.expandGeometries,
            current?.expandGeometries ?? [],
        ),
        newMaterials: added(
            settled.expandMaterials,
            current?.expandMaterials ?? [],
        ),
    };
}

const noRenderResourceChanges = {
    programsLinked: [],
    programsReleased: [],
    newGeometries: [],
    newMaterials: [],
};

test('#25 the preview holds no extra lease once settled, builds no shader or geometry per corner and frees them on close', async ({
    mount,
    page,
}) => {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
    await mount(<BlockOptionsFixture profileStats />);
    await waitForBlockOptionsFixture(page, { blockId: terrainSource });

    // The closed scene at rest: the leases hold still for a second.
    let baselineLeases = await readRuntimeLeases(page);
    await expect
        .poll(
            async () => {
                const previous = baselineLeases;
                await page.waitForTimeout(1000);
                baselineLeases = await readRuntimeLeases(page);
                return (
                    JSON.stringify(baselineLeases) === JSON.stringify(previous)
                );
            },
            { timeout: 20_000 },
        )
        .toBe(true);
    expect(baselineLeases).not.toBeNull();
    expect((await readRenderResources(page))?.programs).toBeGreaterThan(0);

    // A plant (time-driven material, sway) and terrain with its shared rim.
    const cases: { blockId: string; corners: Cell[] }[] = [
        {
            blockId: bush,
            corners: [
                { x: -4, z: -2 },
                { x: -3, z: -1 },
                { x: -4, z: 0 },
                { x: -2, z: -2 },
                { x: -2, z: 0 },
                { x: -4, z: -2 },
            ],
        },
        {
            blockId: terrainSource,
            corners: [
                { x: 4, z: -3 },
                { x: 2, z: -4 },
                { x: 3, z: -3 },
                { x: 4, z: -4 },
                // Back on the source cell, then out again.
                { x: 1, z: -4 },
                { x: 4, z: -3 },
            ],
        },
    ];
    for (const { blockId, corners } of cases) {
        const [first, ...rest] = corners;
        if (!first) {
            throw new Error('Expected a corner.');
        }

        // The sequence ends where it starts, so a pass through it comes
        // back to the first corner.
        expect(corners.at(-1)).toEqual(first);

        // The scene keeps what the first Expand makes it upload for good,
        // e.g. the source block's outline pass, which lives as long as the
        // scene. One warm-up session through every corner first, so the
        // check below catches what an Expand session itself leaves behind.
        const warmUp = await startExpand(page, blockId);
        await setCorner(page, first);
        await expect(warmUp).toHaveAttribute(
            'data-block-expand-ghosts',
            'parts',
        );
        await visitCorners(page, rest);
        await page.waitForTimeout(600);
        await page.evaluate(() =>
            window.__blockOptionsProbe?.closeBlockEditing(),
        );
        await expect(warmUp).toHaveCount(0);
        await expect
            .poll(() => readRuntimeLeases(page), { timeout: 20_000 })
            .toEqual(baselineLeases);
        await waitForDrawnFrames(page);
        await page.waitForTimeout(600);
        const closedResources = await readRenderResources(page);

        const handle = await startExpand(page, blockId);
        await setCorner(page, first);
        await expect.poll(() => readCorner(page)).toEqual(first);
        await expect(handle).toHaveAttribute(
            'data-block-expand-ghosts',
            'parts',
        );

        // The templates freeze once they hold still: no lease, frame
        // callback or fixed step of theirs keeps a frame loop running.
        await expect
            .poll(() => readRuntimeLeases(page), { timeout: 20_000 })
            .toEqual(baselineLeases);
        // Some shader variants link lazily, on a later frame or at the
        // first corner that needs them, so the session passes through the
        // corners once before it is measured. Then frames are asked for
        // until two reads agree.
        await visitCorners(page, rest);
        let settled = await readRenderResources(page);
        await expect
            .poll(
                async () => {
                    const previous = settled;
                    await waitForDrawnFrames(page);
                    await page.waitForTimeout(500);
                    settled = await readRenderResources(page);
                    return JSON.stringify(settled) === JSON.stringify(previous);
                },
                { timeout: 20_000 },
            )
            .toBe(true);
        const settledIds = await readRenderResourceIds(page);
        if (!settledIds) {
            throw new Error('Expected the probe to list render resources.');
        }
        expect(settledIds.expandGeometries.length).toBeGreaterThan(0);

        // Corner changes rewrite instance matrices and nothing else. The
        // counts alone would miss a program or geometry disposed and built
        // again (as drei's `Line` did with new points), so the ids must
        // stay the same too.
        for (const corner of rest) {
            await setCorner(page, corner);
            await expect.poll(() => readCorner(page)).toEqual(corner);
            await waitForDrawnFrames(page);
            await page.waitForTimeout(400);
            expect(
                await readRenderResources(page),
                `${blockId} at ${corner.x},${corner.z}`,
            ).toEqual(settled);
            expect(
                diffRenderResourceIds(
                    settledIds,
                    await readRenderResourceIds(page),
                ),
                `${blockId} at ${corner.x},${corner.z}`,
            ).toEqual(noRenderResourceChanges);
        }
        await expect
            .poll(() => readRuntimeLeases(page), { timeout: 20_000 })
            .toEqual(baselineLeases);

        // Closing frees the ghosts' materials, the plates and the outline.
        await page.evaluate(() =>
            window.__blockOptionsProbe?.closeBlockEditing(),
        );
        await expect(handle).toHaveCount(0);
        await expect
            .poll(() => readRenderResources(page), {
                message: `${blockId} after close`,
                timeout: 10_000,
            })
            .toEqual(closedResources);
        await expect
            .poll(() => readRuntimeLeases(page), { timeout: 20_000 })
            .toEqual(baselineLeases);
    }

    expectCleanRun(errors, backend);
});
