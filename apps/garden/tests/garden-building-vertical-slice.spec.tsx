import {
    type BrowserContext,
    expect,
    type Locator,
    type Page,
    test,
} from '@playwright/test';

const portraitViewport = { height: 844, width: 390 };
const landscapeViewport = { height: 390, width: 844 };
const buildingProfileUrl =
    '/debug/profile/game?avatar=1&building=1&hud=1&controls=1&quality=low&staticSceneCache=legacy';
const buildingKeyboardProfileUrl =
    '/debug/profile/game?building=1&hud=1&quality=low&staticSceneCache=legacy';

function isKnownLocalAnalytics404(text: string, sourceUrl: string) {
    if (!text.startsWith('Failed to load resource:') || !text.includes('404')) {
        return false;
    }
    try {
        const url = new URL(sourceUrl);
        return (
            ['localhost', '127.0.0.1', '::1'].includes(url.hostname) &&
            url.pathname === '/_vercel/insights/script.js'
        );
    } catch {
        return false;
    }
}

async function waitForStructureInsideVisibleViewport(
    page: Page,
    viewport: Readonly<{ width: number; height: number }>,
) {
    await page.waitForFunction(({ height, width }) => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        if (typeof profile !== 'object' || profile === null) {
            return false;
        }
        const read = (key: string) => Number(Reflect.get(profile, key));
        const projectedLeft = read('gardenStructureProjectedLeft');
        const projectedTop = read('gardenStructureProjectedTop');
        const projectedRight = read('gardenStructureProjectedRight');
        const projectedBottom = read('gardenStructureProjectedBottom');
        const visibleLeft = read('gardenStructureVisibleLeft');
        const visibleTop = read('gardenStructureVisibleTop');
        const visibleRight = read('gardenStructureVisibleRight');
        const visibleBottom = read('gardenStructureVisibleBottom');
        const values = [
            projectedLeft,
            projectedTop,
            projectedRight,
            projectedBottom,
            visibleLeft,
            visibleTop,
            visibleRight,
            visibleBottom,
        ];
        return (
            values.every(Number.isFinite) &&
            (width <= height
                ? Math.abs(visibleRight - width * 0.93) < 2
                : Math.abs(visibleLeft - width * 0.48) < 2) &&
            projectedLeft >= visibleLeft - 1 &&
            projectedTop >= visibleTop - 1 &&
            projectedRight <= visibleRight + 1 &&
            projectedBottom <= visibleBottom + 1
        );
    }, viewport);
}

async function tapCenter(page: Page, locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
    const bounds = await locator.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) {
        return;
    }
    await page.touchscreen.tap(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
    );
}

async function dispatchCanvasTouchGesture({
    cancel = true,
    context,
    locator,
    page,
    pointerCount,
}: {
    cancel?: boolean;
    context: BrowserContext;
    locator: Locator;
    page: Page;
    pointerCount: 1 | 2;
}) {
    const bounds = await locator.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) {
        throw new Error('Canvas bounds are unavailable');
    }
    const centerX = bounds.x + bounds.width * 0.68;
    const centerY = bounds.y + bounds.height * 0.45;
    const session = await context.newCDPSession(page);
    const startPoints = [
        {
            id: 101,
            x: centerX - (pointerCount === 2 ? 24 : 0),
            y: centerY,
            radiusX: 8,
            radiusY: 8,
            force: 1,
        },
        ...(pointerCount === 2
            ? [
                  {
                      id: 102,
                      x: centerX + 24,
                      y: centerY,
                      radiusX: 8,
                      radiusY: 8,
                      force: 1,
                  },
              ]
            : []),
    ];
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: startPoints,
    });
    if (pointerCount === 2) {
        await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
                { ...startPoints[0], x: centerX - 42, y: centerY - 6 },
                { ...startPoints[1], x: centerX + 42, y: centerY + 6 },
            ],
        });
    }

    if (cancel) {
        await session.send('Input.dispatchTouchEvent', {
            type: 'touchCancel',
            touchPoints: [],
        });
        await session.detach();
    }
    return session;
}

async function dispatchTouchDrag({
    context,
    from,
    page,
    to,
}: {
    context: BrowserContext;
    from: Readonly<{ x: number; y: number }>;
    page: Page;
    to: Readonly<{ x: number; y: number }>;
}) {
    const session = await context.newCDPSession(page);
    const point = {
        id: 201,
        radiusX: 8,
        radiusY: 8,
        force: 1,
    };
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ ...point, ...from }],
    });
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...point, ...to }],
    });
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
    });
    await session.detach();
}

test('keeps one canvas through the touch-first building slice in portrait and landscape', async ({
    browser,
}, testInfo) => {
    // This proof intentionally exercises a full WebGL lifecycle (touch entry,
    // template recompilation, viewport rotation, pinch zoom, and teardown). The
    // shared CI runner executes it near the end of the serial WebGL suite, where
    // software rendering can be substantially slower than an isolated run.
    test.setTimeout(120_000);
    const context = await browser.newContext({
        hasTouch: true,
        viewport: portraitViewport,
    });
    await context.addInitScript(() => {
        Reflect.set(window, '__gardenStructurePointerTypes', []);
        const pointerState = {
            activeCount: 0,
            cancelCount: 0,
            lostCaptureCount: 0,
        };
        const activePointerIds = new Set<number>();
        Reflect.set(window, '__gardenStructurePointerState', pointerState);
        const publishActiveCount = () => {
            pointerState.activeCount = activePointerIds.size;
        };
        window.addEventListener(
            'pointerdown',
            (event) => {
                const pointerTypes = Reflect.get(
                    window,
                    '__gardenStructurePointerTypes',
                );
                if (Array.isArray(pointerTypes)) {
                    pointerTypes.push(event.pointerType);
                }
                activePointerIds.add(event.pointerId);
                publishActiveCount();
            },
            { capture: true },
        );
        window.addEventListener(
            'pointerup',
            (event) => {
                activePointerIds.delete(event.pointerId);
                publishActiveCount();
            },
            { capture: true },
        );
        window.addEventListener(
            'pointercancel',
            (event) => {
                pointerState.cancelCount += 1;
                activePointerIds.delete(event.pointerId);
                publishActiveCount();
            },
            { capture: true },
        );
        window.addEventListener(
            'lostpointercapture',
            (event) => {
                pointerState.lostCaptureCount += 1;
                activePointerIds.delete(event.pointerId);
                publishActiveCount();
            },
            { capture: true },
        );
    });

    const page = await context.newPage();
    const browserErrors: string[] = [];
    const failedResourceResponses: string[] = [];
    const buildingAssetRequests: string[] = [];
    page.on('console', (message) => {
        const sourceUrl = message.location().url;
        const isExpectedSignedOutRequest =
            message.text() ===
            'Failed to load resource: the server responded with a status of 401 (Unauthorized)';
        const isExpectedLocalAnalyticsRequest = isKnownLocalAnalytics404(
            message.text(),
            sourceUrl,
        );
        if (
            message.type() === 'error' &&
            !isExpectedSignedOutRequest &&
            !isExpectedLocalAnalyticsRequest
        ) {
            browserErrors.push(
                `${message.text()} (${sourceUrl || 'unknown source'})`,
            );
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('response', (response) => {
        if (response.status() >= 400) {
            failedResourceResponses.push(
                `${response.status()} ${response.request().method()} ${response.url()}`,
            );
        }
    });
    page.on('request', (request) => {
        const url = request.url();
        const assetName = new URL(url).pathname.split('/').at(-1) ?? '';
        if (
            /\.glb(?:\?|$)/u.test(url) &&
            assetName === 'GardenStructureKitV1.glb'
        ) {
            buildingAssetRequests.push(url);
        }
    });

    await page.goto(buildingProfileUrl, { waitUntil: 'networkidle' });
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toBeVisible();
    const originalCanvas = await canvas.elementHandle();
    expect(originalCanvas).not.toBeNull();
    await expect(
        page.locator(
            '[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay',
        ),
    ).toHaveCount(0);
    await page.waitForFunction(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        return (
            typeof profile === 'object' &&
            profile !== null &&
            Number.isFinite(
                Number(Reflect.get(profile, 'gardenStructureCameraZoom')),
            )
        );
    });
    const initialCamera = await page.evaluate(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        if (typeof profile !== 'object' || profile === null) {
            throw new Error('Game profile metadata is unavailable');
        }
        return {
            positionX: Number(
                Reflect.get(profile, 'gardenStructureCameraPositionX'),
            ),
            positionY: Number(
                Reflect.get(profile, 'gardenStructureCameraPositionY'),
            ),
            positionZ: Number(
                Reflect.get(profile, 'gardenStructureCameraPositionZ'),
            ),
            targetX: Number(
                Reflect.get(profile, 'gardenStructureCameraTargetX'),
            ),
            targetY: Number(
                Reflect.get(profile, 'gardenStructureCameraTargetY'),
            ),
            targetZ: Number(
                Reflect.get(profile, 'gardenStructureCameraTargetZ'),
            ),
            zoom: Number(Reflect.get(profile, 'gardenStructureCameraZoom')),
        };
    });

    const controlsDialog = page.getByRole('dialog');
    if (await controlsDialog.isVisible()) {
        await tapCenter(
            page,
            controlsDialog.getByRole('button', { name: 'Zatvori' }),
        );
        await expect(controlsDialog).toHaveCount(0);
    }

    const avatarEntry = page.getByRole('button', {
        name: 'Prošetaj vrtom',
    });
    await expect(avatarEntry).toBeVisible({ timeout: 15_000 });
    await tapCenter(page, avatarEntry);
    const avatarExit = page.getByRole('button', {
        name: 'Izađi iz šetnje',
    });
    await expect(avatarExit).toBeVisible();
    await tapCenter(page, avatarExit);

    const entry = page.getByTestId('garden-structure-build-entry');
    await expect(entry).toBeVisible();
    await tapCenter(page, entry);

    const hud = page.getByTestId('garden-structure-build-hud');
    const sheet = page.getByTestId('garden-structure-build-sheet');
    await expect(hud).toBeVisible();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('garden-structure-build-done')).toBeFocused();
    await expect(avatarEntry).toHaveCount(0);
    await expect(hud).toContainText('12 / 100 polja');
    await expect(hud).toContainText('600 🌻');
    await waitForStructureInsideVisibleViewport(page, portraitViewport);
    await expect(canvas).toHaveCount(1);
    if (originalCanvas) {
        expect(
            await canvas.evaluate(
                (currentCanvas, initialCanvas) =>
                    currentCanvas === initialCanvas,
                originalCanvas,
            ),
        ).toBe(true);
    }

    await tapCenter(page, page.getByRole('button', { name: 'Prazno' }));
    await expect(hud).toContainText('4 / 100 polja');
    await expect(hud).toContainText('200 🌻');
    await tapCenter(page, page.getByRole('button', { name: 'Kuća' }));
    await page.waitForFunction(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        return (
            typeof profile === 'object' &&
            profile !== null &&
            Number(Reflect.get(profile, 'gardenStructurePlanCacheHitCount')) >=
                1
        );
    });
    const partSelect = page.getByTestId('garden-structure-part-select');
    const openDoorId = 'edge:debug-garden-structure:door-main';
    await expect(
        partSelect.locator(`option[value="${openDoorId}"]`),
    ).toHaveCount(1);
    await partSelect.selectOption(openDoorId);
    await expect(hud).toContainText(`Odabrano: ${openDoorId}`);
    await tapCenter(page, page.getByRole('button', { name: 'Sakrij krov' }));
    await expect(
        page.getByRole('button', { name: 'Prikaži krov' }),
    ).toBeVisible();
    await tapCenter(
        page,
        page.getByRole('button', { name: 'Krov', exact: true }),
    );
    await expect(
        partSelect.locator('option[value^="roof:debug-garden-structure:"]'),
    ).not.toHaveCount(0);
    await tapCenter(page, page.getByRole('button', { name: 'Tlocrt' }));
    const footprintTargets = await page
        .locator('[data-structure-canvas-target-kind="add-cell"]')
        .evaluateAll((elements) =>
            elements.flatMap((element) => {
                const id = element.getAttribute('data-structure-canvas-target');
                const bounds = element.getBoundingClientRect();
                if (!id) {
                    return [];
                }
                const [worldX, worldY] = id.split('|').map(Number);
                return Number.isFinite(worldX) && Number.isFinite(worldY)
                    ? [
                          {
                              screenX: bounds.x + bounds.width / 2,
                              screenY: bounds.y + bounds.height / 2,
                              worldX,
                              worldY,
                          },
                      ]
                    : [];
            }),
        );
    const addRow = footprintTargets
        .filter(
            (target, _index, targets) =>
                targets.filter(
                    (candidate) => candidate.worldY === target.worldY,
                ).length >= 2,
        )
        .toSorted((left, right) =>
            left.worldY === right.worldY
                ? left.worldX - right.worldX
                : left.worldY - right.worldY,
        );
    const firstAddTarget = addRow[0];
    const lastAddTarget = addRow.findLast(
        (target) => target.worldY === firstAddTarget?.worldY,
    );
    expect(firstAddTarget).toBeDefined();
    expect(lastAddTarget).toBeDefined();
    if (!firstAddTarget || !lastAddTarget) {
        throw new Error('A coalesced footprint target row is unavailable');
    }
    await dispatchTouchDrag({
        context,
        from: { x: firstAddTarget.screenX, y: firstAddTarget.screenY },
        page,
        to: { x: lastAddTarget.screenX, y: lastAddTarget.screenY },
    });
    const footprintDialog = page.getByRole('alertdialog', {
        name: 'Potvrditi promjenu tlocrta?',
    });
    await expect(footprintDialog).toBeVisible();
    await expect(footprintDialog).toContainText('15 / 100');
    await footprintDialog.getByRole('button', { name: 'Vrati tlocrt' }).click();
    await expect(footprintDialog).toHaveCount(0);
    await expect(
        partSelect.locator(
            'option[value="footprint:debug-garden-structure:-1|2"]',
        ),
    ).toHaveCount(1);

    await tapCenter(
        page,
        page.getByRole('button', { name: 'Ruka / pomicanje' }),
    );
    await expect(
        page.getByRole('button', { name: 'Ruka / pomicanje' }),
    ).toHaveAttribute('aria-pressed', 'true');
    const targetBeforeHandPan = await page.evaluate(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        return Number(
            typeof profile === 'object' && profile !== null
                ? Reflect.get(profile, 'gardenStructureCameraTargetX')
                : Number.NaN,
        );
    });
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    if (!canvasBounds) {
        throw new Error('Canvas bounds are unavailable for Hand pan');
    }
    await dispatchTouchDrag({
        context,
        from: {
            x: canvasBounds.x + canvasBounds.width * 0.65,
            y: canvasBounds.y + canvasBounds.height * 0.38,
        },
        page,
        to: {
            x: canvasBounds.x + canvasBounds.width * 0.72,
            y: canvasBounds.y + canvasBounds.height * 0.38,
        },
    });
    await page.waitForFunction((before) => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        return (
            typeof profile === 'object' &&
            profile !== null &&
            Math.abs(
                Number(Reflect.get(profile, 'gardenStructureCameraTargetX')) -
                    before,
            ) > 0.01
        );
    }, targetBeforeHandPan);

    await tapCenter(page, page.getByRole('button', { name: 'Konstrukcija' }));
    await page.getByLabel('Dio lanca').selectOption('window.house');
    const northEdgeTargets = page.locator(
        '[data-structure-canvas-target-kind="edge"][data-structure-canvas-target$=":N"]',
    );
    await expect(northEdgeTargets).not.toHaveCount(0);
    const edgeTargets = await northEdgeTargets.evaluateAll((elements) =>
        elements.flatMap((element) => {
            const id = element.getAttribute('data-structure-canvas-target');
            const bounds = element.getBoundingClientRect();
            if (!id) {
                return [];
            }
            const [cellKey] = id.split(':');
            const [cellX, cellY] = cellKey.split('|').map(Number);
            return Number.isFinite(cellX) && Number.isFinite(cellY)
                ? [
                      {
                          cellX,
                          cellY,
                          screenX: bounds.x + bounds.width / 2,
                          screenY: bounds.y + bounds.height / 2,
                      },
                  ]
                : [];
        }),
    );
    const edgeRow = edgeTargets
        .filter(
            (target, _index, targets) =>
                targets.filter((candidate) => candidate.cellY === target.cellY)
                    .length >= 2,
        )
        .toSorted((left, right) =>
            left.cellY === right.cellY
                ? left.cellX - right.cellX
                : left.cellY - right.cellY,
        );
    const firstEdge = edgeRow[0];
    const secondEdge = edgeRow.find(
        (target) =>
            target.cellY === firstEdge?.cellY &&
            target.cellX !== firstEdge.cellX,
    );
    expect(firstEdge).toBeDefined();
    expect(secondEdge).toBeDefined();
    if (!firstEdge || !secondEdge) {
        throw new Error('A collinear edge pair is unavailable');
    }
    await page.touchscreen.tap(firstEdge.screenX, firstEdge.screenY);
    await page.touchscreen.tap(secondEdge.screenX, secondEdge.screenY);
    await expect(hud).toContainText('rubova čeka potvrdu');
    await tapCenter(page, page.getByRole('button', { name: 'Potvrdi lanac' }));
    await expect(hud).toContainText(/Lanac s \d+ rubova je primijenjen/);

    await tapCenter(page, page.getByRole('button', { name: 'Tlocrt' }));
    await tapCenter(page, page.getByRole('button', { name: 'Zakreni 90°' }));

    await page.waitForFunction(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        return (
            typeof profile === 'object' &&
            profile !== null &&
            Number(Reflect.get(profile, 'gardenStructureRenderBatchCount')) >
                0 &&
            Number(
                Reflect.get(profile, 'gardenStructureCollisionBucketCount'),
            ) > 0
        );
    });

    await page.setViewportSize(landscapeViewport);
    await expect(canvas).toBeVisible();
    await expect(sheet).toBeVisible();
    const landscapeSheetBounds = await sheet.boundingBox();
    expect(landscapeSheetBounds).not.toBeNull();
    expect(landscapeSheetBounds?.height).toBeLessThan(landscapeViewport.height);
    expect(landscapeSheetBounds?.width).toBeLessThan(
        landscapeViewport.width / 2,
    );
    await waitForStructureInsideVisibleViewport(page, landscapeViewport);
    await page.screenshot({
        path: testInfo.outputPath('garden-building-landscape.png'),
    });

    const zoomBeforePinch = await page.evaluate(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        return Number(
            typeof profile === 'object' && profile !== null
                ? Reflect.get(profile, 'gardenStructureCameraZoom')
                : Number.NaN,
        );
    });
    await dispatchCanvasTouchGesture({
        context,
        locator: canvas,
        page,
        pointerCount: 2,
    });
    await page.waitForFunction((before) => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        return (
            typeof profile === 'object' &&
            profile !== null &&
            Math.abs(
                Number(Reflect.get(profile, 'gardenStructureCameraZoom')) -
                    before,
            ) > 0.1
        );
    }, zoomBeforePinch);
    const activeTouchSession = await dispatchCanvasTouchGesture({
        cancel: false,
        context,
        locator: canvas,
        page,
        pointerCount: 1,
    });
    await page.getByTestId('garden-structure-build-done').evaluate((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            throw new Error('Done control is not a button');
        }
        button.click();
    });
    await page.waitForFunction(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        return (
            typeof profile === 'object' &&
            profile !== null &&
            Reflect.get(profile, 'gardenStructureCameraActivePointerCount') ===
                0
        );
    });
    await activeTouchSession.send('Input.dispatchTouchEvent', {
        type: 'touchCancel',
        touchPoints: [],
    });
    await activeTouchSession.detach();
    await expect(hud).toHaveCount(0);
    await expect(entry).toBeVisible();
    await expect(entry).toBeFocused();
    await expect(canvas).toHaveCount(1);
    await page.waitForFunction(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        if (typeof profile !== 'object' || profile === null) {
            return false;
        }
        return Reflect.get(profile, 'gardenStructureCameraMode') === 'browse';
    });
    const restoredCamera = await page.evaluate(() => {
        const profile = Reflect.get(window, '__grediceGameProfile');
        if (typeof profile !== 'object' || profile === null) {
            throw new Error('Game profile metadata is unavailable');
        }
        return {
            positionX: Number(
                Reflect.get(profile, 'gardenStructureCameraPositionX'),
            ),
            positionY: Number(
                Reflect.get(profile, 'gardenStructureCameraPositionY'),
            ),
            positionZ: Number(
                Reflect.get(profile, 'gardenStructureCameraPositionZ'),
            ),
            targetX: Number(
                Reflect.get(profile, 'gardenStructureCameraTargetX'),
            ),
            targetY: Number(
                Reflect.get(profile, 'gardenStructureCameraTargetY'),
            ),
            targetZ: Number(
                Reflect.get(profile, 'gardenStructureCameraTargetZ'),
            ),
            zoom: Number(Reflect.get(profile, 'gardenStructureCameraZoom')),
        };
    });
    expect(restoredCamera.positionX).toBeCloseTo(initialCamera.positionX, 3);
    expect(restoredCamera.positionY).toBeCloseTo(initialCamera.positionY, 3);
    expect(restoredCamera.positionZ).toBeCloseTo(initialCamera.positionZ, 3);
    expect(restoredCamera.targetX).toBeCloseTo(initialCamera.targetX, 3);
    expect(restoredCamera.targetY).toBeCloseTo(initialCamera.targetY, 3);
    expect(restoredCamera.targetZ).toBeCloseTo(initialCamera.targetZ, 3);
    expect(restoredCamera.zoom).toBeCloseTo(initialCamera.zoom, 3);
    if (originalCanvas) {
        expect(
            await canvas.evaluate(
                (currentCanvas, initialCanvas) =>
                    currentCanvas === initialCanvas,
                originalCanvas,
            ),
        ).toBe(true);
    }

    const pointerTypes = await page.evaluate(() =>
        Reflect.get(window, '__gardenStructurePointerTypes'),
    );
    expect(pointerTypes).toContain('touch');
    const pointerState = await page.evaluate(() =>
        Reflect.get(window, '__gardenStructurePointerState'),
    );
    expect(pointerState).toMatchObject({ activeCount: 0 });
    if (typeof pointerState !== 'object' || pointerState === null) {
        throw new Error('Pointer state is unavailable');
    }
    expect(Number(Reflect.get(pointerState, 'cancelCount'))).toBeGreaterThan(0);
    expect(
        Number(Reflect.get(pointerState, 'lostCaptureCount')),
    ).toBeGreaterThan(0);
    expect(buildingAssetRequests).toHaveLength(1);
    expect(buildingAssetRequests[0]).toContain('/GardenStructureKitV1.glb');
    expect(
        browserErrors,
        `Unexpected failed responses: ${failedResourceResponses
            .filter((response) => !response.startsWith('401 '))
            .join(', ')}`,
    ).toEqual([]);
    await context.close();
});

test('keeps the production-profile building fixture disabled by default', async ({
    page,
}) => {
    const buildingAssetRequests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/GardenStructureKitV1.glb')) {
            buildingAssetRequests.push(request.url());
        }
    });
    await page.goto('/debug/profile/game?hud=1&controls=1', {
        waitUntil: 'networkidle',
    });

    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByTestId('garden-structure-build-entry')).toHaveCount(
        0,
    );
    await expect(page.locator('main')).toHaveAttribute(
        'data-game-profile-building',
        '0',
    );
    expect(buildingAssetRequests).toEqual([]);
});

test('keeps the public debug sandbox on the managed default-off path', async ({
    page,
}) => {
    await page.goto('/debug/sandbox', { waitUntil: 'networkidle' });

    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByTestId('garden-structure-build-entry')).toHaveCount(
        0,
    );
});

test('supports keyboard authoring, reduced motion, Escape unwinding, and focus return', async ({
    page,
}) => {
    test.setTimeout(30_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(buildingKeyboardProfileUrl, { waitUntil: 'networkidle' });

    const entry = page.getByTestId('garden-structure-build-entry');
    await entry.focus();
    await page.keyboard.press('Enter');
    const done = page.getByTestId('garden-structure-build-done');
    await expect(done).toBeFocused();

    const structureTool = page.getByRole('button', {
        name: 'Konstrukcija',
    });
    await structureTool.focus();
    await page.keyboard.press('Enter');
    await page.getByLabel('Dio lanca').selectOption('window.house');
    const selectedCell = page.getByLabel('Odabrano polje');
    await selectedCell.selectOption('0|0');
    await page.getByLabel('Strana ruba za lanac').selectOption('N');
    const startEdge = page.getByRole('button', { name: 'Postavi početak' });
    await startEdge.focus();
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('button', { name: 'Postavi kraj' }),
    ).toBeVisible();
    await selectedCell.selectOption('1|0');
    const finishEdge = page.getByRole('button', { name: 'Postavi kraj' });
    await finishEdge.focus();
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('button', { name: 'Potvrdi lanac' }),
    ).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(
        page.getByRole('button', { name: 'Potvrdi lanac' }),
    ).toHaveCount(0);

    const footprintTool = page.getByRole('button', { name: 'Tlocrt' });
    await footprintTool.focus();
    await page.keyboard.press('Enter');
    const reducedMotionCanvasTarget = page
        .locator('[data-structure-canvas-target]')
        .first();
    await expect(reducedMotionCanvasTarget).toBeVisible();
    await expect
        .poll(() =>
            reducedMotionCanvasTarget.evaluate(
                (element) => getComputedStyle(element).transitionDuration,
            ),
        )
        .toBe('0s');

    const handTool = page.getByRole('button', {
        name: 'Ruka / pomicanje',
    });
    await handTool.focus();
    await page.keyboard.press('Enter');
    await expect(handTool).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Odabir' })).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    await expect(done).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(entry).toBeFocused();
});
