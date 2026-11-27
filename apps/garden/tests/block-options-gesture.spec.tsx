import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import type { JSX } from 'react';
import type { GameStateStore } from '../../../packages/game/src/useGameState';
import { BlockOptionsFixture } from '../../../packages/game/tests/BlockOptionsFixture';
import {
    blockOptionsFixtureBlockIds,
    blockOptionsFixtureGardenId,
    blockOptionsFixtureGroundId,
    blockOptionsFixtureStageSizes,
    createBlockOptionsFixtureGarden,
    createBlockOptionsFixtureStacks,
} from '../../../packages/game/tests/blockOptionsFixtureData';
import {
    type BlockOptionsRecordedWrite,
    captureBlockOptionsReview,
    collectPageErrors,
    createBlockOptionsTouch,
    getBlockScreenPosition,
    installBlockOptionsBackend,
    readBlockOptionsProbe,
    waitForBlockOptionsFixture,
} from './blockOptionsTestSupport';

// Spec §14.3 #10-#20 (WP-4, gesture integration): a hold released without
// moving opens the block options pop-up on the per-entity (`PickableGroup`)
// and the instanced (`InstancedBlockInteractionController`) paths, with no
// request, no tap bounce and no selection; drags, clicks and double-clicks
// keep working; Pomakni hands its pointer to the pickup (drag and carry).
//
// Pomakni is pressed on the pop-up's real tile (WP-5), which calls
// `requestBlockMove` synchronously in its `pointerdown` (D18).

test.setTimeout(90_000);
// As in block-options-expand.spec.tsx: one frame of the fixture garden can
// take a second or more on the CI software renderer, so assertions wait
// longer than the default 5 s.
const expect = baseExpect.configure({ timeout: 15_000 });

const { beachBall, bush, gardenBox, snowman } = blockOptionsFixtureBlockIds;
const sheepFold = 'sheep-fold';
const stacksPath = `/api/gardens/${blockOptionsFixtureGardenId}/stacks`;
/** The pop-up ignores activations this soon after it opened (§3.5). */
const popupGhostClickGuardMs = 350;
/** Generous for swiftshader on a loaded machine; a lift takes 320 ms. */
const liftTimeoutMs = 10_000;

type GestureSpy = {
    store: GameStateStore;
    /** Every bounce queued after the spy was installed, in order. */
    bounces: { blockId: string; kind: string }[];
};

/** The parts of a three.js object the scene checks read. */
type SceneNode = {
    name: string;
    parent: SceneNode | null;
    position: { y: number };
    getObjectByName: (name: string) => SceneNode | undefined;
};

declare global {
    interface Window {
        __blockOptionsGestureSpy?: GestureSpy;
        /** Scenes three.js announced through its devtools hook. */
        __blockOptionsGestureScenes?: SceneNode[];
        /** The fold's own `PickableGroup` group, held across the carry. */
        __blockOptionsGestureFoldGroup?: SceneNode | null;
    }
}

type Point = { x: number; y: number };

type MoveOperation = { op: 'move'; from: unknown; path: unknown };

function isMoveOperation(value: unknown): value is MoveOperation {
    return (
        typeof value === 'object' &&
        value !== null &&
        Reflect.get(value, 'op') === 'move'
    );
}

/** The `move` operations of the stacks PATCHes, in order. */
function moveOperations(writes: BlockOptionsRecordedWrite[]) {
    return writes
        .filter(
            (write) => write.method === 'PATCH' && write.path === stacksPath,
        )
        .flatMap((write): unknown[] =>
            Array.isArray(write.body) ? write.body : [],
        )
        .filter(isMoveOperation);
}

/** The fixture stacks with one block moved to the top of another cell. */
function moveFixtureBlock(blockId: string, to: { x: number; z: number }) {
    const stacks = createBlockOptionsFixtureStacks();
    for (const stack of stacks) {
        const index = stack.blocks.findIndex((block) => block.id === blockId);
        const [moved] = index >= 0 ? stack.blocks.splice(index, 1) : [];
        const destination = stacks.find(
            (candidate) =>
                candidate.position.x === to.x && candidate.position.z === to.z,
        );
        if (moved && destination) {
            destination.blocks.push(moved);
            return stacks;
        }
    }
    return stacks;
}

/** The fixture stacks with a `SheepFold` (2 × 2 from its cell) added. */
function withSheepFold(cell: { x: number; z: number }) {
    const stacks = createBlockOptionsFixtureStacks();
    const stack = stacks.find(
        (candidate) =>
            candidate.position.x === cell.x && candidate.position.z === cell.z,
    );
    stack?.blocks.push({ id: sheepFold, name: 'SheepFold', rotation: 0 });
    return stacks;
}

function rotateWrites(writes: BlockOptionsRecordedWrite[]) {
    return writes.filter(
        (write) =>
            write.method === 'PUT' && /\/blocks\/[^/]+$/.test(write.path),
    );
}

/**
 * Finds the fixture's game store through React's fiber of the fixture root
 * and records the bounces it queues. Test-only: the probe does not expose
 * the store, and these specs need the bounce log and garden box state.
 */
async function installGestureSpy(page: Page) {
    const installed = await page.evaluate(() => {
        function isGameStateStore(value: unknown): value is GameStateStore {
            if (typeof value !== 'object' || value === null) {
                return false;
            }
            const getState: unknown = Reflect.get(value, 'getState');
            if (typeof getState !== 'function') {
                return false;
            }
            const state: unknown = getState.call(value);
            return (
                typeof state === 'object' &&
                state !== null &&
                typeof Reflect.get(state, 'requestBlockMove') === 'function'
            );
        }

        const root = document.querySelector('[data-block-options-fixture]');
        const fiberKey = root
            ? Object.keys(root).find((key) => key.startsWith('__reactFiber$'))
            : undefined;
        let fiber: unknown =
            root && fiberKey ? Reflect.get(root, fiberKey) : null;
        let store: GameStateStore | null = null;
        while (typeof fiber === 'object' && fiber !== null && !store) {
            const props: unknown = Reflect.get(fiber, 'memoizedProps');
            const value: unknown =
                typeof props === 'object' && props !== null
                    ? Reflect.get(props, 'value')
                    : null;
            if (isGameStateStore(value)) {
                store = value;
            }
            fiber = Reflect.get(fiber, 'return');
        }
        if (!store) {
            return false;
        }

        const spy: GestureSpy = {
            store,
            bounces: [],
        };
        const seenRenderIds = new Set<number>();
        store.subscribe((state) => {
            for (const animation of Object.values(
                state.blockPlacementDropAnimations,
            )) {
                if (seenRenderIds.has(animation.renderId)) {
                    continue;
                }
                seenRenderIds.add(animation.renderId);
                spy.bounces.push({
                    blockId: animation.sourceBlockId,
                    kind: animation.kind ?? 'drop',
                });
            }
        });
        window.__blockOptionsGestureSpy = spy;
        return true;
    });
    expect(installed).toBe(true);
}

async function mountGestureFixture(
    page: Page,
    {
        blockId,
        blockOptionsUi = true,
        viewport = 'desktop',
    }: {
        blockId: string;
        /** False mounts the game as with its HUD hidden. */
        blockOptionsUi?: boolean;
        viewport?: 'desktop' | 'phone';
    },
    mount: (component: JSX.Element) => Promise<unknown>,
) {
    const errors = collectPageErrors(page);
    const backend = await installBlockOptionsBackend(page);
    await page.setViewportSize(blockOptionsFixtureStageSizes[viewport]);
    await mount(
        <BlockOptionsFixture
            blockOptionsUi={blockOptionsUi}
            viewport={viewport}
        />,
    );
    await waitForBlockOptionsFixture(page, { blockId });
    await installGestureSpy(page);
    return { backend, errors };
}

function readEditing(page: Page) {
    return page.evaluate(() => {
        const editing = window.__blockOptionsProbe?.blockEditing ?? null;
        return editing
            ? {
                  mode: editing.mode,
                  blockId: editing.blockId,
                  pointerType:
                      'pointerType' in editing ? editing.pointerType : null,
              }
            : null;
    });
}

function readMode(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.blockEditing?.mode ?? null,
    );
}

function readPickupBlockId(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.pickupBlockId ?? null,
    );
}

function readPlacementLocked(page: Page) {
    return page.evaluate(
        () => window.__blockOptionsProbe?.camera.placementLocked ?? null,
    );
}

/** The carried block's offset from its cell, or null with no drag preview. */
function readActiveDragRelative(page: Page) {
    return page.evaluate(() => {
        const relative =
            window.__blockOptionsGestureSpy?.store.getState().activeDragPreview
                ?.relative ?? null;
        // Normalised so -0 compares equal to 0.
        return relative ? { x: relative.x + 0, z: relative.z + 0 } : null;
    });
}

/**
 * Collects the scenes three.js creates from now on through its devtools
 * hook (`__THREE_DEVTOOLS__`, read by the `Scene` constructor), so a check
 * can hold on to a scene object. Call before `mount`.
 */
async function installSceneObserver(page: Page) {
    await page.evaluate(() => {
        function isSceneNode(value: unknown): value is SceneNode {
            return (
                typeof value === 'object' &&
                value !== null &&
                Reflect.get(value, 'isScene') === true &&
                typeof Reflect.get(value, 'getObjectByName') === 'function'
            );
        }

        const scenes: SceneNode[] = [];
        const hook = new EventTarget();
        hook.addEventListener('observe', (event) => {
            const detail: unknown =
                event instanceof CustomEvent ? event.detail : null;
            if (isSceneNode(detail)) {
                scenes.push(detail);
            }
        });
        Reflect.set(window, '__THREE_DEVTOOLS__', hook);
        window.__blockOptionsGestureScenes = scenes;
    });
}

function readBounces(page: Page) {
    return page.evaluate(() => window.__blockOptionsGestureSpy?.bounces ?? []);
}

function readOpenGardenBoxBlockId(page: Page) {
    return page.evaluate(
        () =>
            window.__blockOptionsGestureSpy?.store.getState()
                .openGardenBoxBlockId ?? null,
    );
}

function countEditingOutlineGroups(page: Page) {
    return page.evaluate(
        () =>
            window.__blockOptionsProbe?.countObjects(
                'BlockOptions:EditingOutline',
            ) ?? 0,
    );
}

function openBlockOptions(page: Page, blockId: string, pointerType = 'mouse') {
    return page.evaluate(
        ([id, pointer]) =>
            window.__blockOptionsProbe?.openBlockOptions(id, pointer) ?? null,
        [blockId, pointerType] as const,
    );
}

/** Screen offset of a move by `dx`, `dz` cells (orthographic: any height). */
async function cellDelta(page: Page, dx: number, dz: number): Promise<Point> {
    const delta = await page.evaluate(
        ([x, z]) => {
            const probe = window.__blockOptionsProbe;
            const from = probe?.projectWorld(0, 0, 0);
            const to = probe?.projectWorld(x, 0, z);
            return from && to ? { x: to.x - from.x, y: to.y - from.y } : null;
        },
        [dx, dz] as const,
    );
    if (!delta) {
        throw new Error('Expected the probe to project cells.');
    }
    return delta;
}

async function parkMouse(page: Page) {
    // The sky in the top middle: no block, no HUD stand-in.
    await page.mouse.move(480, 150, { steps: 4 });
}

/** Presses on a block with the mouse until it lifts (320 ms hold). */
async function mouseHoldUntilLifted(page: Page, point: Point, blockId: string) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await page.mouse.down();
    await expect
        .poll(() => readPickupBlockId(page), { timeout: liftTimeoutMs })
        .toBe(blockId);
}

/**
 * The centre of the pop-up's Pomakni tile, once the pop-up is placed, its
 * open animation has settled and its ghost-click guard has passed.
 */
async function getMoveButtonCenter(page: Page): Promise<Point> {
    await expect(
        page.locator('[data-block-options-popup-layer][data-placed="true"]'),
    ).toHaveCount(1, { timeout: liftTimeoutMs });
    const moveTile = page.locator(
        '[data-block-options-popup] [data-block-options-action="move"]',
    );
    await expect(moveTile).toBeVisible();
    await page.waitForTimeout(popupGhostClickGuardMs);
    let previous: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null = null;
    await expect
        .poll(
            async () => {
                const box = await moveTile.boundingBox();
                const settled =
                    box !== null &&
                    previous !== null &&
                    Math.abs(box.x - previous.x) < 0.5 &&
                    Math.abs(box.y - previous.y) < 0.5 &&
                    Math.abs(box.width - previous.width) < 0.5;
                previous = box;
                return settled;
            },
            { intervals: [100] },
        )
        .toBe(true);
    if (!previous) {
        throw new Error('Pomakni has no box.');
    }
    const box: { x: number; y: number; width: number; height: number } =
        previous;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Points on a block, centre first, to tap where the pop-up does not cover. */
async function getBlockTapCandidates(page: Page, blockId: string) {
    const center = await getBlockScreenPosition(page, blockId, 'center');
    const top = await getBlockScreenPosition(page, blockId, 'top');
    const candidates: Point[] = [
        center,
        { x: center.x, y: center.y + 6 },
        { x: center.x - 6, y: center.y },
        { x: center.x + 6, y: center.y },
        { x: (center.x + top.x) / 2, y: (center.y + top.y) / 2 },
        { x: center.x, y: center.y - 6 },
    ];
    return candidates;
}

/**
 * The first candidate the pop-up does not cover (the pop-up sits next to
 * the block and may overlap its centre), in one round trip.
 */
async function findUncoveredPoint(page: Page, candidates: Point[]) {
    const point = await page.evaluate(
        (points) =>
            points.find(
                ({ x, y }) =>
                    document.elementFromPoint(x, y)?.tagName === 'CANVAS',
            ) ?? null,
        candidates,
    );
    if (!point) {
        throw new Error('The pop-up covers every candidate point.');
    }
    return point;
}

async function expectSessionEnded(page: Page) {
    await expect.poll(() => readPickupBlockId(page)).toBeNull();
    await expect.poll(() => readMode(page)).toBeNull();
    await expect.poll(() => readPlacementLocked(page)).toBe(false);
}

function screenshotPath(name: string) {
    return test.info().outputPath(`${name}.png`);
}

test.describe('mouse', () => {
    test('#10 a still mouse hold on a per-entity block opens the pop-up with no request, bounce or selection', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: beachBall },
            mount,
        );

        const ball = await getBlockScreenPosition(page, beachBall);
        await mouseHoldUntilLifted(page, ball, beachBall);
        await page.waitForTimeout(80);
        await page.mouse.up();

        await expect
            .poll(() => readEditing(page))
            .toEqual({
                mode: 'menu',
                blockId: beachBall,
                pointerType: 'mouse',
            });
        expect(await readPickupBlockId(page)).toBeNull();
        expect(await readPlacementLocked(page)).toBe(false);
        // The editing outline (D19) is on the ball's group.
        await expect.poll(() => countEditingOutlineGroups(page)).toBe(1);

        // Past the click, bounce and single-click windows.
        await parkMouse(page);
        await page.waitForTimeout(700);
        expect(await readMode(page)).toBe('menu');
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-10-entity-menu'),
        });
        expect(backend.writes).toEqual([]);
        const bounces = await readBounces(page);
        expect(
            bounces.filter((bounce) => bounce.blockId === beachBall),
        ).toEqual([{ blockId: beachBall, kind: 'pickup' }]);

        await page.keyboard.press('Escape');
        await expect.poll(() => readMode(page)).toBeNull();
        await expect.poll(() => countEditingOutlineGroups(page)).toBe(0);
        expect(errors).toEqual([]);
    });

    test('#10 a still mouse hold on an instanced garden box opens the pop-up and not the garden box', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: gardenBox },
            mount,
        );

        const box = await getBlockScreenPosition(page, gardenBox);
        await mouseHoldUntilLifted(page, box, gardenBox);
        await page.mouse.up();
        await expect
            .poll(() => readEditing(page))
            .toEqual({
                mode: 'menu',
                blockId: gardenBox,
                pointerType: 'mouse',
            });
        await parkMouse(page);
        // The instanced outline comes from `blockEditing` (D19). The garden
        // box draws its body and lid from the same instances, so both parts
        // are outlined on its cell, as during the hold.
        await expect
            .poll(async () => {
                const cells =
                    (await readBlockOptionsProbe(page))?.outline
                        .instancedCells ?? [];
                return (
                    cells.length > 0 &&
                    cells.every((cell) => cell.x === 3 && cell.z === 1)
                );
            })
            .toBe(true);
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-10-instanced-menu'),
        });

        await page.waitForTimeout(700);
        expect(await readOpenGardenBoxBlockId(page)).toBeNull();
        expect(await readMode(page)).toBe('menu');
        expect(backend.writes).toEqual([]);
        expect(
            (await readBounces(page)).filter(
                (bounce) => bounce.blockId === gardenBox,
            ),
        ).toEqual([{ blockId: gardenBox, kind: 'pickup' }]);
        expect(errors).toEqual([]);
    });

    for (const target of [
        {
            name: 'per-entity',
            blockId: beachBall,
            from: { x: 0, z: 0 },
            index: 1,
            by: { x: 0, z: -3 },
        },
        {
            name: 'instanced',
            blockId: bush,
            from: { x: -2, z: 0 },
            index: 1,
            by: { x: 3, z: 0 },
        },
    ]) {
        test(`#12 hold and drag three cells moves the ${target.name} block with no pop-up`, async ({
            mount,
            page,
        }) => {
            const { backend, errors } = await mountGestureFixture(
                page,
                { blockId: target.blockId },
                mount,
            );

            const start = await getBlockScreenPosition(page, target.blockId);
            const delta = await cellDelta(page, target.by.x, target.by.z);
            await mouseHoldUntilLifted(page, start, target.blockId);
            await page.mouse.move(start.x + delta.x, start.y + delta.y, {
                steps: 16,
            });
            await page.mouse.up();

            const to = {
                x: target.from.x + target.by.x,
                z: target.from.z + target.by.z,
            };
            await expect
                .poll(() => moveOperations(backend.writes))
                .toEqual([
                    {
                        op: 'move',
                        from: `/${target.from.x}/${target.from.z}/${target.index}`,
                        path: `/${to.x}/${to.z}/-`,
                    },
                ]);
            await expectSessionEnded(page);
            await page.waitForTimeout(500);
            expect(await readMode(page)).toBeNull();
            expect(errors).toEqual([]);
        });
    }

    for (const target of [
        { name: 'per-entity', blockId: beachBall },
        { name: 'instanced', blockId: bush },
    ]) {
        test(`#13 a 4 px jitter after the lift still opens the pop-up on the ${target.name} block`, async ({
            mount,
            page,
        }) => {
            const { backend, errors } = await mountGestureFixture(
                page,
                { blockId: target.blockId },
                mount,
            );

            const start = await getBlockScreenPosition(page, target.blockId);
            await mouseHoldUntilLifted(page, start, target.blockId);
            await page.mouse.move(start.x + 3, start.y - 2, { steps: 3 });
            await page.mouse.move(start.x - 2, start.y + 3, { steps: 3 });
            await page.mouse.move(start.x + 4, start.y, { steps: 3 });
            await page.mouse.up();

            await expect
                .poll(() => readEditing(page))
                .toEqual({
                    mode: 'menu',
                    blockId: target.blockId,
                    pointerType: 'mouse',
                });
            await page.waitForTimeout(600);
            expect(backend.writes).toEqual([]);
            expect(errors).toEqual([]);
        });
    }

    test('#14 a short click, a double-click and a tap right after a hold-release', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: snowman },
            mount,
        );
        // The snowman: a per-entity block with no click handling of its own
        // (the beach ball kicks itself on click and never rotates).
        const snowmanPoint = await getBlockScreenPosition(page, snowman);

        // Short click: the tap bounce, no pop-up, no request.
        await page.mouse.move(snowmanPoint.x, snowmanPoint.y, { steps: 4 });
        await page.mouse.click(snowmanPoint.x, snowmanPoint.y);
        await page.waitForTimeout(600);
        expect(await readMode(page)).toBeNull();
        expect(backend.writes).toEqual([]);
        expect(
            (await readBounces(page)).filter(
                (bounce) => bounce.blockId === snowman,
            ),
        ).toEqual([{ blockId: snowman, kind: 'tap' }]);

        // Double-click: exactly one rotation, no pop-up.
        await page.mouse.dblclick(snowmanPoint.x, snowmanPoint.y);
        await expect.poll(() => rotateWrites(backend.writes).length).toBe(1);
        expect(rotateWrites(backend.writes)[0]).toMatchObject({
            method: 'PUT',
            path: `/api/gardens/${blockOptionsFixtureGardenId}/blocks/${snowman}`,
            body: { rotation: 1 },
        });
        await page.waitForTimeout(700);
        expect(await readMode(page)).toBeNull();
        expect(rotateWrites(backend.writes)).toHaveLength(1);

        // The instanced path rotates on a double-click too (its `doRotate`
        // has the same new guards).
        const bushPoint = await getBlockScreenPosition(page, bush);
        await page.mouse.move(bushPoint.x, bushPoint.y, { steps: 4 });
        await page.mouse.dblclick(bushPoint.x, bushPoint.y);
        await expect.poll(() => rotateWrites(backend.writes).length).toBe(2);
        expect(rotateWrites(backend.writes)[1]).toMatchObject({
            method: 'PUT',
            path: `/api/gardens/${blockOptionsFixtureGardenId}/blocks/${bush}`,
            body: { rotation: 1 },
        });
        await page.waitForTimeout(700);
        expect(await readMode(page)).toBeNull();
        expect(rotateWrites(backend.writes)).toHaveLength(2);

        // Hold-release (pop-up), then a tap on the same block at once: the
        // tap closes the pop-up and is not the second half of a double-tap.
        for (const blockId of [snowman, bush]) {
            const point = await getBlockScreenPosition(page, blockId);
            // Measured before the release, so the tap follows it at once.
            const tapCandidates = await getBlockTapCandidates(page, blockId);
            await mouseHoldUntilLifted(page, point, blockId);
            await page.mouse.up();
            const releasedAt = Date.now();
            await expect.poll(() => readMode(page)).toBe('menu');
            // Tap a part of the block the pop-up does not cover.
            const tap = await findUncoveredPoint(page, tapCandidates);
            await page.mouse.click(tap.x, tap.y);
            // The double-tap window is 320 ms; the record shows whether the
            // tap landed inside it on this machine.
            test.info().annotations.push({
                type: 'release-to-tap-ms',
                description: `${blockId}: ${Date.now() - releasedAt}`,
            });
            await page.waitForTimeout(800);
            expect(await readMode(page)).toBeNull();
            expect(rotateWrites(backend.writes)).toHaveLength(2);
        }
        expect(backend.writes.length).toBe(2);
        expect(errors).toEqual([]);
    });

    test('#15 the instanced outline survives a garden refetch while the pop-up is open', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: blockOptionsFixtureGroundId(0, 3) },
            mount,
        );
        const grassId = blockOptionsFixtureGroundId(0, 3);
        const grass = await getBlockScreenPosition(page, grassId, 'top');
        await mouseHoldUntilLifted(page, grass, grassId);
        await page.mouse.up();
        await expect.poll(() => readMode(page)).toBe('menu');
        await parkMouse(page);
        await expect
            .poll(
                async () =>
                    (await readBlockOptionsProbe(page))?.outline.instancedCells,
            )
            .toEqual([{ x: 0, z: 3 }]);

        // A refetch brings new stack objects (and one more bush).
        const stacks = createBlockOptionsFixtureStacks();
        stacks
            .find((stack) => stack.position.x === -1 && stack.position.z === 1)
            ?.blocks.push({
                id: 'gesture-extra-bush',
                name: 'Bush',
                rotation: 0,
            });
        backend.setGarden(createBlockOptionsFixtureGarden({ stacks }));
        await page.evaluate(() =>
            window.__blockOptionsProbe?.invalidateGarden(),
        );
        await expect
            .poll(async () =>
                (await readBlockOptionsProbe(page))?.garden?.blocks.some(
                    (block) => block.id === 'gesture-extra-bush',
                ),
            )
            .toBe(true);

        expect(await readMode(page)).toBe('menu');
        await expect
            .poll(
                async () =>
                    (await readBlockOptionsProbe(page))?.outline.instancedCells,
            )
            .toEqual([{ x: 0, z: 3 }]);
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-15-grass-outline-after-refetch'),
        });
        expect(backend.writes).toEqual([]);
        expect(errors).toEqual([]);
    });

    for (const target of [
        {
            name: 'per-entity',
            blockId: beachBall,
            from: { x: 0, z: 0 },
            index: 1,
            by: { x: 2, z: 0 },
        },
        {
            name: 'instanced',
            blockId: bush,
            from: { x: -2, z: 0 },
            index: 1,
            by: { x: 0, z: 2 },
        },
    ]) {
        test(`#16 Pomakni with an 8 px wobble leaves the ${target.name} block in place`, async ({
            mount,
            page,
        }) => {
            const { backend, errors } = await mountGestureFixture(
                page,
                { blockId: target.blockId },
                mount,
            );
            await openBlockOptions(page, target.blockId);
            const button = await getMoveButtonCenter(page);
            await page.mouse.move(button.x, button.y, { steps: 2 });
            await page.mouse.down();
            await expect
                .poll(() => readPickupBlockId(page))
                .toBe(target.blockId);
            expect(await readMode(page)).toBe('moving');
            await page.mouse.move(button.x + 8, button.y, { steps: 4 });
            await page.mouse.up();

            await expectSessionEnded(page);
            await page.waitForTimeout(500);
            expect(backend.writes).toEqual([]);
            expect(errors).toEqual([]);
        });

        test(`#17 Pomakni dragged two cells moves the ${target.name} block two cells`, async ({
            mount,
            page,
        }) => {
            const { backend, errors } = await mountGestureFixture(
                page,
                { blockId: target.blockId },
                mount,
            );
            await openBlockOptions(page, target.blockId);
            const button = await getMoveButtonCenter(page);
            const delta = await cellDelta(page, target.by.x, target.by.z);
            await page.mouse.move(button.x, button.y, { steps: 2 });
            await page.mouse.down();
            await expect
                .poll(() => readPickupBlockId(page))
                .toBe(target.blockId);
            await page.mouse.move(
                button.x + delta.x / 2,
                button.y + delta.y / 2,
                { steps: 8 },
            );
            await captureBlockOptionsReview(page, {
                path: screenshotPath(`gesture-17-${target.name}-dragging`),
            });
            await page.mouse.move(button.x + delta.x, button.y + delta.y, {
                steps: 8,
            });
            await page.mouse.up();

            const to = {
                x: target.from.x + target.by.x,
                z: target.from.z + target.by.z,
            };
            await expect
                .poll(() => moveOperations(backend.writes))
                .toEqual([
                    {
                        op: 'move',
                        from: `/${target.from.x}/${target.from.z}/${target.index}`,
                        path: `/${to.x}/${to.z}/-`,
                    },
                ]);
            await expectSessionEnded(page);
            expect(errors).toEqual([]);
        });
    }

    test('#18 Pomakni clicked with a mouse carries the instanced bush: hover follows, a click drops it', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: bush },
            mount,
        );
        await openBlockOptions(page, bush);
        const button = await getMoveButtonCenter(page);
        await page.mouse.move(button.x, button.y, { steps: 2 });
        await page.mouse.down();
        await page.mouse.up();

        await expect
            .poll(() => readEditing(page))
            .toEqual({ mode: 'carry', blockId: bush, pointerType: 'mouse' });
        expect(await readPickupBlockId(page)).toBe(bush);
        expect(await readPlacementLocked(page)).toBe(true);

        // Hover: the lifted bush follows the cursor to the grass at (-2, 2);
        // in carry the block lands on the cell under the pointer.
        const destination = await getBlockScreenPosition(
            page,
            blockOptionsFixtureGroundId(-2, 2),
            'top',
        );
        await page.mouse.move(destination.x, destination.y, { steps: 10 });
        await page.waitForTimeout(300);
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-18-mouse-carry'),
        });
        expect(backend.writes).toEqual([]);
        expect(await readMode(page)).toBe('carry');

        await page.mouse.click(destination.x, destination.y);
        await expect
            .poll(() => moveOperations(backend.writes))
            .toEqual([{ op: 'move', from: '/-2/0/1', path: '/-2/2/-' }]);
        await expectSessionEnded(page);
        // The click that dropped the bush did not open anything.
        await page.waitForTimeout(600);
        expect(await readOpenGardenBoxBlockId(page)).toBeNull();
        expect(await readMode(page)).toBeNull();
        expect(errors).toEqual([]);
    });

    test('#18 Pomakni from the keyboard carries the per-entity ball; a click drops it', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: beachBall },
            mount,
        );
        await openBlockOptions(page, beachBall);
        await getMoveButtonCenter(page);
        await page
            .locator(
                '[data-block-options-popup] [data-block-options-action="move"]',
            )
            .focus();
        await page.keyboard.press('Enter');

        // No pointer: the receiver lifts the ball straight into carry.
        await expect
            .poll(() => readEditing(page))
            .toEqual({
                mode: 'carry',
                blockId: beachBall,
                pointerType: 'keyboard',
            });
        expect(await readPickupBlockId(page)).toBe(beachBall);
        expect(backend.writes).toEqual([]);
        // Until a pointer hovers or adopts the carry, the ball stays lifted
        // over its own cell (§2.6 D3).
        await page.waitForTimeout(400);
        expect(await readActiveDragRelative(page)).toEqual({ x: 0, z: 0 });

        const destination = await getBlockScreenPosition(
            page,
            blockOptionsFixtureGroundId(0, 2),
            'top',
        );
        await page.mouse.move(destination.x, destination.y, { steps: 8 });
        await page.mouse.click(destination.x, destination.y);
        await expect
            .poll(() => moveOperations(backend.writes))
            .toEqual([{ op: 'move', from: '/0/0/1', path: '/0/2/-' }]);
        await expectSessionEnded(page);
        expect(errors).toEqual([]);
    });

    test('#18 Pomakni from the keyboard keeps blocks away from the canvas centre on their own cells', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: snowman },
            mount,
        );
        // The instanced bush at (-2, 0) and the per-entity snowman at (2, 2):
        // the cell under the canvas centre is another one for both.
        for (const blockId of [bush, snowman]) {
            await openBlockOptions(page, blockId);
            await getMoveButtonCenter(page);
            await page
                .locator(
                    '[data-block-options-popup] [data-block-options-action="move"]',
                )
                .focus();
            await page.keyboard.press('Enter');
            await expect
                .poll(() => readEditing(page))
                .toEqual({ mode: 'carry', blockId, pointerType: 'keyboard' });
            await page.waitForTimeout(400);
            expect(await readActiveDragRelative(page)).toEqual({
                x: 0,
                z: 0,
            });
            // The hint sits right above the block, not over another cell.
            const blockTop = await getBlockScreenPosition(page, blockId, 'top');
            await expect
                .poll(async () => {
                    const box = await page
                        .locator('[data-block-move-carry-bubble]')
                        .boundingBox();
                    if (!box) {
                        return false;
                    }
                    const offsetX = box.x + box.width / 2 - blockTop.x;
                    const offsetY = box.y + box.height - blockTop.y;
                    return (
                        Math.abs(offsetX) < 24 && offsetY < 0 && offsetY > -80
                    );
                })
                .toBe(true);
            // Swiftshader can hold the hint's fade-in for a moment.
            await page.waitForTimeout(600);
            await captureBlockOptionsReview(page, {
                path: screenshotPath(`gesture-18-keyboard-carry-${blockId}`),
            });

            await page.keyboard.press('Escape');
            await expectSessionEnded(page);
        }
        expect(backend.writes).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('#18 Pomakni on a SheepFold lifts the fold, not one of its sheep', async ({
        mount,
        page,
    }) => {
        test.setTimeout(150_000);
        const errors = collectPageErrors(page);
        const stacks = withSheepFold({ x: -1, z: 3 });
        const backend = await installBlockOptionsBackend(page, {
            garden: createBlockOptionsFixtureGarden({ stacks }),
        });
        await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
        await installSceneObserver(page);
        await mount(
            <BlockOptionsFixture viewport="desktop" stacks={stacks} sheep />,
        );
        await waitForBlockOptionsFixture(page, { blockId: sheepFold });
        await installGestureSpy(page);
        // Each sheep is a `PickableGroup` handle for the fold.
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () =>
                            window.__blockOptionsProbe?.countObjects(
                                'Sheep_Root',
                            ) ?? 0,
                    ),
                { timeout: 30_000 },
            )
            .toBeGreaterThan(0);

        // The fold's entity remounts in another chunk (x -1 to x 1) after
        // the sheep mounted, as after a move. The first move receiver for a
        // block id wins, so a sheep that registered would now come first.
        backend.setGarden(
            createBlockOptionsFixtureGarden({
                stacks: withSheepFold({ x: 1, z: 3 }),
            }),
        );
        await page.evaluate(() =>
            window.__blockOptionsProbe?.invalidateGarden(),
        );
        await expect
            .poll(() =>
                page.evaluate(
                    (id) =>
                        window.__blockOptionsProbe?.garden?.blocks.find(
                            (block) => block.id === id,
                        )?.x ?? null,
                    sheepFold,
                ),
            )
            .toBe(1);
        await waitForBlockOptionsFixture(page, { blockId: sheepFold });

        await openBlockOptions(page, sheepFold);
        await getMoveButtonCenter(page);
        // Only the fold's own group carries the editing outline.
        expect(await countEditingOutlineGroups(page)).toBe(1);
        const foundFoldGroup = await page.evaluate(() => {
            const group =
                window.__blockOptionsGestureScenes
                    ?.map((scene) =>
                        scene.getObjectByName(
                            'BlockOptions:EditingOutline:entity',
                        ),
                    )
                    .find((object) => object !== undefined) ?? null;
            window.__blockOptionsGestureFoldGroup = group;
            return group !== null;
        });
        expect(foundFoldGroup).toBe(true);

        await page
            .locator(
                '[data-block-options-popup] [data-block-options-action="move"]',
            )
            .focus();
        await page.keyboard.press('Enter');
        await expect
            .poll(() => readEditing(page))
            .toEqual({
                mode: 'carry',
                blockId: sheepFold,
                pointerType: 'keyboard',
            });
        // The fold's own group lifts (pickup lift 0.1), still mounted.
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const group = window.__blockOptionsGestureFoldGroup;
                    return group?.parent ? group.position.y : null;
                }),
            )
            .toBeGreaterThan(0.05);
        expect(await readActiveDragRelative(page)).toEqual({ x: 0, z: 0 });
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-18-sheep-fold-carry'),
        });

        await page.keyboard.press('Escape');
        await expectSessionEnded(page);
        expect(backend.writes).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('#19 carry ignores a right-click and settles on Escape with no request; an overlay bubble adopts', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: beachBall },
            mount,
        );

        async function startCarry() {
            await openBlockOptions(page, beachBall);
            const button = await getMoveButtonCenter(page);
            await page.mouse.move(button.x, button.y, { steps: 2 });
            await page.mouse.down();
            await page.mouse.up();
            await expect.poll(() => readMode(page)).toBe('carry');
            await page.mouse.move(button.x, button.y + 2);
        }

        await startCarry();
        const destination = await getBlockScreenPosition(
            page,
            blockOptionsFixtureGroundId(0, 2),
            'top',
        );

        // Right-click: ignored, still carrying.
        await page.mouse.click(destination.x, destination.y, {
            button: 'right',
        });
        await page.waitForTimeout(300);
        expect(await readMode(page)).toBe('carry');
        expect(await readPickupBlockId(page)).toBe(beachBall);

        // Escape: settles on the source cell, no request.
        await page.keyboard.press('Escape');
        await expectSessionEnded(page);
        await page.waitForTimeout(400);
        expect(backend.writes).toEqual([]);

        // An animal speech bubble (a drei `Html` button over the garden)
        // counts as the garden: a click on it drops the ball under it, and
        // the bubble's own click does not run. drei mounts `Html` in r3f's
        // event source, the parent of the canvas's own container (not the
        // canvas's parent); the bubble goes where the real carry hint is.
        await startCarry();
        await expect(
            page.locator('[data-block-move-carry-bubble]'),
        ).toHaveCount(1);
        await page.evaluate((point) => {
            const canvasContainer =
                document.querySelector('canvas')?.parentElement;
            const wrapper = canvasContainer?.parentElement;
            const carryHint = document.querySelector(
                '[data-block-move-carry-bubble]',
            );
            if (
                !canvasContainer ||
                !wrapper ||
                !carryHint ||
                !wrapper.contains(carryHint) ||
                canvasContainer.contains(carryHint)
            ) {
                throw new Error('Expected drei overlays in the event source.');
            }
            const bubble = document.createElement('button');
            bubble.type = 'button';
            bubble.textContent = 'Kvak!';
            bubble.dataset.actorSpeechBubble = '';
            bubble.dataset.gestureClicks = '0';
            Object.assign(bubble.style, {
                position: 'fixed',
                left: `${point.x - 30}px`,
                top: `${point.y - 12}px`,
                width: '60px',
                height: '24px',
                zIndex: '50',
            });
            bubble.addEventListener('click', () => {
                bubble.dataset.gestureClicks = String(
                    Number(bubble.dataset.gestureClicks) + 1,
                );
            });
            wrapper.append(bubble);
        }, destination);
        await page.mouse.move(destination.x, destination.y, { steps: 6 });
        await page.mouse.click(destination.x, destination.y);
        await expect
            .poll(() => moveOperations(backend.writes))
            .toEqual([{ op: 'move', from: '/0/0/1', path: '/0/2/-' }]);
        await expectSessionEnded(page);
        await page.waitForTimeout(300);
        expect(
            await page.evaluate(
                () =>
                    document.querySelector<HTMLElement>(
                        '[data-actor-speech-bubble]',
                    )?.dataset.gestureClicks,
            ),
        ).toBe('0');
        expect(errors).toEqual([]);
    });

    test('#19b a double-click on Pomakni keeps carrying: the second press neither drops nor rotates', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: beachBall },
            mount,
        );
        await openBlockOptions(page, beachBall);
        const button = await getMoveButtonCenter(page);
        await page.mouse.move(button.x, button.y, { steps: 2 });
        // Players double-click blocks to rotate them, so a double-click on
        // Pomakni is likely; its second press lands on the canvas where
        // the pop-up was.
        await page.mouse.dblclick(button.x, button.y, { delay: 40 });

        await expect
            .poll(() => readEditing(page))
            .toEqual({
                mode: 'carry',
                blockId: beachBall,
                pointerType: 'mouse',
            });
        await page.waitForTimeout(700);
        expect(await readMode(page)).toBe('carry');
        expect(await readPickupBlockId(page)).toBe(beachBall);
        expect(backend.writes).toEqual([]);

        // The carry still takes the next click on a cell.
        const destination = await getBlockScreenPosition(
            page,
            blockOptionsFixtureGroundId(0, 2),
            'top',
        );
        await page.mouse.move(destination.x, destination.y, { steps: 6 });
        await page.mouse.click(destination.x, destination.y);
        await expect
            .poll(() => moveOperations(backend.writes))
            .toEqual([{ op: 'move', from: '/0/0/1', path: '/0/2/-' }]);
        await expectSessionEnded(page);
        expect(rotateWrites(backend.writes)).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('#10b with the HUD hidden a still hold-release settles with no pop-up state or outline', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: beachBall, blockOptionsUi: false },
            mount,
        );

        // Per-entity ball, then the instanced bush.
        for (const blockId of [beachBall, bush]) {
            const point = await getBlockScreenPosition(page, blockId);
            await mouseHoldUntilLifted(page, point, blockId);
            await page.waitForTimeout(80);
            await page.mouse.up();
            await expectSessionEnded(page);
            await parkMouse(page);
            await page.waitForTimeout(700);
            expect(await readMode(page), blockId).toBeNull();
            expect(await countEditingOutlineGroups(page), blockId).toBe(0);
            expect(
                (await readBlockOptionsProbe(page))?.outline.instancedCells,
                blockId,
            ).toEqual([]);
        }
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-10b-hidden-hud-settled'),
        });
        expect(backend.writes).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('#22 an Expand corner tap on a fence gate moves the corner and leaves the gate shut', async ({
        mount,
        page,
    }) => {
        const errors = collectPageErrors(page);
        const gate = 'fence-gate';
        const gateCell = { x: -1, z: 1 };
        const stacks = createBlockOptionsFixtureStacks();
        stacks
            .find(
                (stack) =>
                    stack.position.x === gateCell.x &&
                    stack.position.z === gateCell.z,
            )
            ?.blocks.push({ id: gate, name: 'FenceGate', rotation: 0 });
        const backend = await installBlockOptionsBackend(page, {
            garden: createBlockOptionsFixtureGarden({ stacks }),
        });
        await page.setViewportSize(blockOptionsFixtureStageSizes.desktop);
        await mount(<BlockOptionsFixture viewport="desktop" stacks={stacks} />);
        await waitForBlockOptionsFixture(page, { blockId: gate });
        await installGestureSpy(page);

        const started = await page.evaluate(
            (id) => window.__blockOptionsProbe?.startBlockExpand(id) ?? null,
            bush,
        );
        expect(started).toEqual({ ok: true });
        await expect(page.locator('[data-block-expand-handle]')).toHaveCount(1);
        const source = await page.evaluate(() => {
            const editing = window.__blockOptionsProbe?.blockEditing;
            return editing?.mode === 'expand' ? editing.corner : null;
        });

        const point = await getBlockScreenPosition(page, gate, 'center');
        await page.mouse.move(point.x, point.y, { steps: 4 });
        await page.mouse.click(point.x, point.y);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const editing = window.__blockOptionsProbe?.blockEditing;
                    return editing?.mode === 'expand' ? editing.corner : null;
                }),
            )
            .not.toEqual(source);
        // Past the gate's single-click delay: it did not toggle.
        await page.waitForTimeout(700);
        expect(await readMode(page)).toBe('expand');
        expect(backend.writes).toEqual([]);
        expect(await readOpenGardenBoxBlockId(page)).toBeNull();
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-22-expand-gate-tap'),
        });

        // Once Expand closes, a click toggles the gate again.
        await page.keyboard.press('Escape');
        await expect.poll(() => readMode(page)).toBeNull();
        await page.waitForTimeout(500);
        await page.mouse.click(point.x, point.y);
        await expect
            .poll(() =>
                backend.writes.map((write) => [write.method, write.path]),
            )
            .toEqual([
                [
                    'PUT',
                    `/api/gardens/${blockOptionsFixtureGardenId}/blocks/${gate}`,
                ],
            ]);
        expect(errors).toEqual([]);
    });
});

test.describe('touch', () => {
    test.use({ hasTouch: true });

    test('#11 a still touch hold on instanced grass opens the pop-up', async ({
        mount,
        page,
    }) => {
        const grassId = blockOptionsFixtureGroundId(0, 3);
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: grassId, viewport: 'phone' },
            mount,
        );
        const point = await getBlockScreenPosition(page, grassId, 'top');
        const touch = await createBlockOptionsTouch(page);
        try {
            await touch.start(point);
            await expect
                .poll(() => readPickupBlockId(page), { timeout: liftTimeoutMs })
                .toBe(grassId);
            await touch.end();
        } finally {
            await touch.detach();
        }

        await expect
            .poll(() => readEditing(page))
            .toEqual({ mode: 'menu', blockId: grassId, pointerType: 'touch' });
        expect(await readPlacementLocked(page)).toBe(false);
        await expect
            .poll(
                async () =>
                    (await readBlockOptionsProbe(page))?.outline.instancedCells,
            )
            .toEqual([{ x: 0, z: 3 }]);
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-11-touch-grass-menu'),
        });
        await page.waitForTimeout(700);
        expect(await readMode(page)).toBe('menu');
        expect(backend.writes).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('#18 Pomakni tapped on a phone carries the ball; a tap on a cell drops it', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: beachBall, viewport: 'phone' },
            mount,
        );
        // The stub API saves the move, so the refetch after the drop keeps
        // the ball where it landed.
        backend.setWriteResponder((write) => {
            if (write.method === 'PATCH' && write.path === stacksPath) {
                backend.setGarden(
                    createBlockOptionsFixtureGarden({
                        stacks: moveFixtureBlock(beachBall, { x: 0, z: 2 }),
                    }),
                );
            }
            return undefined;
        });
        const touch = await createBlockOptionsTouch(page);
        try {
            // Hold-release on the ball opens the pop-up.
            const ball = await getBlockScreenPosition(page, beachBall);
            await touch.start(ball);
            await expect
                .poll(() => readPickupBlockId(page), { timeout: liftTimeoutMs })
                .toBe(beachBall);
            await touch.end();
            await expect
                .poll(() => readEditing(page))
                .toEqual({
                    mode: 'menu',
                    blockId: beachBall,
                    pointerType: 'touch',
                });

            // Tap Pomakni: the ball stays lifted and waits for a cell.
            const button = await getMoveButtonCenter(page);
            await touch.start(button);
            await touch.end();
            await expect
                .poll(() => readEditing(page))
                .toEqual({
                    mode: 'carry',
                    blockId: beachBall,
                    pointerType: 'touch',
                });
            expect(await readPickupBlockId(page)).toBe(beachBall);
            expect(await readPlacementLocked(page)).toBe(true);
            // The carry hint fades in.
            await expect(
                page.locator('[data-block-move-carry-bubble]'),
            ).toBeVisible();
            await page.waitForTimeout(400);
            await captureBlockOptionsReview(page, {
                path: screenshotPath('gesture-18-touch-carry'),
            });
            expect(backend.writes).toEqual([]);

            // A tap on a HUD stand-in would cancel; tap the cell (0, 2).
            const destination = await getBlockScreenPosition(
                page,
                blockOptionsFixtureGroundId(0, 2),
                'top',
            );
            await touch.start(destination);
            // Adopted: the ball is still lifted while the finger is down.
            await page.waitForTimeout(120);
            expect(await readPickupBlockId(page)).toBe(beachBall);
            await touch.end();
        } finally {
            await touch.detach();
        }

        await expect
            .poll(() => moveOperations(backend.writes))
            .toEqual([{ op: 'move', from: '/0/0/1', path: '/0/2/-' }]);
        await expectSessionEnded(page);
        await expect
            .poll(async () =>
                (await readBlockOptionsProbe(page))?.garden?.blocks.find(
                    (block) => block.id === beachBall,
                ),
            )
            .toMatchObject({ x: 0, z: 2 });
        await page.waitForTimeout(600);
        await captureBlockOptionsReview(page, {
            path: screenshotPath('gesture-18-touch-dropped'),
        });
        expect(errors).toEqual([]);
    });

    test('#19 a tap on the carry bubble area adopts; a tap on a HUD panel cancels', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: beachBall, viewport: 'phone' },
            mount,
        );
        const touch = await createBlockOptionsTouch(page);
        try {
            for (const ending of ['hud', 'bubble'] as const) {
                await openBlockOptions(page, beachBall, 'touch');
                const button = await getMoveButtonCenter(page);
                await touch.start(button);
                await touch.end();
                await expect.poll(() => readMode(page)).toBe('carry');

                if (ending === 'hud') {
                    // The top-left HUD stand-in is not the garden: the
                    // press cancels the carry at once, with no request.
                    await touch.start({ x: 40, y: 30 });
                    await expect.poll(() => readPickupBlockId(page)).toBeNull();
                    await touch.end();
                    await expectSessionEnded(page);
                    await page.waitForTimeout(400);
                    expect(backend.writes).toEqual([]);
                    continue;
                }

                // The carry hint floats over the garden and lets presses
                // through: a tap on it is a tap on the cell under it.
                const bubble = page.locator('[data-block-move-carry-bubble]');
                await expect(bubble).toBeVisible();
                // The hint fades in; capture it once it is opaque.
                await page.waitForTimeout(400);
                await captureBlockOptionsReview(page, {
                    path: screenshotPath('gesture-19-touch-carry-bubble'),
                });
                const box = await bubble.boundingBox();
                if (!box) {
                    throw new Error('The carry hint has no box.');
                }
                const point = {
                    x: box.x + box.width / 2,
                    y: box.y + box.height / 2,
                };
                expect(
                    await page.evaluate(
                        ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
                        point,
                    ),
                ).toBe('CANVAS');
                await touch.start(point);
                // Adopted: the ball stays lifted while the finger is down.
                await page.waitForTimeout(120);
                expect(await readPickupBlockId(page)).toBe(beachBall);
                await touch.end();
                await expectSessionEnded(page);
            }
        } finally {
            await touch.detach();
        }
        // The bubble tap dropped the ball on the cell under the hint.
        await expect.poll(() => moveOperations(backend.writes).length).toBe(1);
        const [drop] = moveOperations(backend.writes);
        expect(drop?.from).toBe('/0/0/1');
        test.info().annotations.push({
            type: 'bubble tap drop',
            description: JSON.stringify(drop),
        });
        expect(errors).toEqual([]);
    });

    test('#20 a Pomakni press-drag-release under 50 ms ends the session and unlocks the camera', async ({
        mount,
        page,
    }) => {
        const { backend, errors } = await mountGestureFixture(
            page,
            { blockId: beachBall, viewport: 'phone' },
            mount,
        );
        await openBlockOptions(page, beachBall, 'touch');
        const button = await getMoveButtonCenter(page);
        const touch = await createBlockOptionsTouch(page);
        const startedAt = Date.now();
        try {
            await touch.start(button);
            await touch.move({ x: button.x + 20, y: button.y + 10 });
            await touch.move({ x: button.x + 40, y: button.y + 20 });
            await touch.end();
        } finally {
            await touch.detach();
        }
        test.info().annotations.push({
            type: 'press-drag-release ms',
            description: String(Date.now() - startedAt),
        });

        await expectSessionEnded(page);
        test.info().annotations.push({
            type: 'writes',
            description: JSON.stringify(
                backend.writes.map(({ method, path, body }) => ({
                    method,
                    path,
                    body,
                })),
            ),
        });
        expect(errors).toEqual([]);
    });
});
