import { expect } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import type { CurrentGarden } from '../../../packages/game/src/hooks/useCurrentGarden';
import {
    type BlockOptionsProbeSnapshot,
    blockOptionsFixtureAccountId,
    blockOptionsFixtureGardenId,
    blockOptionsFixtureUserId,
    createBlockOptionsFixtureGarden,
    toBlockOptionsGardenResponse,
} from '../../../packages/game/tests/blockOptionsFixtureData';

// Node-side helpers shared by the block-options specs
// (`apps/garden/tests/block-options-*.spec.tsx`). The browser side is
// `packages/game/tests/BlockOptionsFixture.tsx` and `BlockOptionsProbe.tsx`.

const apiPrefix = '/api/gredice';

/** A non-GET request the harness answered instead of the API. */
export type BlockOptionsRecordedWrite = {
    method: string;
    /** API path without the app proxy prefix, e.g. `/api/gardens/951/stacks`. */
    path: string;
    url: string;
    /** Parsed JSON body, the raw text when it is not JSON, or null. */
    body: unknown;
};

export type BlockOptionsWriteResponse =
    | { status?: number; json?: unknown; headers?: Record<string, string> }
    | 'abort';

export type BlockOptionsWriteResponder = (
    write: BlockOptionsRecordedWrite,
) =>
    | BlockOptionsWriteResponse
    | undefined
    | Promise<BlockOptionsWriteResponse | undefined>;

export type BlockOptionsBackendOptions = {
    /** The garden the API returns on refetch; defaults to the fixture's. */
    garden?: CurrentGarden;
    /** Account balance the API returns on refetch. */
    sunflowers?: number;
    /** Shopping cart total the API returns on refetch. */
    cartSunflowers?: number;
    /**
     * Answers a recorded write. Return undefined for the default (200 with
     * `{}`), a response, or `'abort'` to fail it at the network level.
     */
    respondToWrite?: BlockOptionsWriteResponder;
};

function parseRequestBody(text: string | null): unknown {
    if (text === null || text === '') {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function gardenSummary(garden: CurrentGarden) {
    return {
        id: garden.id,
        name: garden.name,
        isSandbox: garden.isSandbox,
        isPublic: garden.isPublic,
        backgroundPalette: garden.backgroundPalette,
        homeCamera: garden.homeCamera,
    };
}

/**
 * Routes every `/api` request of the page. No request reaches a real server:
 *
 * - every non-GET request is recorded (method, path, parsed body) and
 *   answered by `respondToWrite` or with 200 `{}`;
 * - GETs the fixture's queries refetch after a mutation (the garden, the
 *   garden lists, the account, its sunflowers, the shopping cart and the
 *   current user) are answered from the backend state, which a spec can
 *   change (`setGarden`, `setSunflowers`, `setCartSunflowers`); garden
 *   operations are empty and weather is unavailable (404, as the game
 *   tolerates);
 * - any other app API GET gets a 404 and is listed in `unhandledGets`.
 *
 * Install it before `mount`. A spec can still add its own `page.route`
 * afterwards; later routes win and can `route.fallback()` to this one.
 */
export async function installBlockOptionsBackend(
    page: Page,
    options: BlockOptionsBackendOptions = {},
) {
    const state = {
        garden: options.garden ?? createBlockOptionsFixtureGarden(),
        sunflowers: options.sunflowers ?? 1000,
        cartSunflowers: options.cartSunflowers ?? 0,
        respondToWrite: options.respondToWrite,
    };
    const writes: BlockOptionsRecordedWrite[] = [];
    const unhandledGets: string[] = [];

    function readGet(path: string): unknown {
        const garden = state.garden;
        switch (path) {
            case `/api/gardens/${blockOptionsFixtureGardenId}`:
                return toBlockOptionsGardenResponse(garden);
            case '/api/gardens':
                return [gardenSummary(garden)];
            case '/api/accounts/gardens':
                return [
                    {
                        accountId: blockOptionsFixtureAccountId,
                        isCurrent: true,
                        gardens: [gardenSummary(garden)],
                    },
                ];
            case '/api/accounts/current':
                return {
                    id: blockOptionsFixtureAccountId,
                    timeZone: 'Europe/Zagreb',
                    createdAt: '2026-05-01T08:00:00Z',
                    updatedAt: '2026-05-01T08:00:00Z',
                };
            case '/api/accounts/current/sunflowers':
                return { amount: state.sunflowers, history: [] };
            case '/api/shopping-cart':
                return {
                    id: 1,
                    accountId: blockOptionsFixtureAccountId,
                    status: 'new',
                    isDeleted: false,
                    createdAt: '2026-06-01T08:00:00Z',
                    updatedAt: '2026-06-01T08:00:00Z',
                    items: [],
                    notes: [],
                    total: 0,
                    totalSunflowers: state.cartSunflowers,
                    allowPurchase: true,
                    hasDeliverableItems: false,
                };
            case `/api/gardens/${blockOptionsFixtureGardenId}/operations`:
                return { items: [], nextCursor: null, total: 0 };
            case '/api/users/current':
                return {
                    id: blockOptionsFixtureUserId,
                    createdAt: '2026-05-01T08:00:00Z',
                    birthdayLastUpdatedAt: null,
                    birthdayLastRewardAt: null,
                    whatsNewLastSeenAt: null,
                };
            default:
                return undefined;
        }
    }

    await page.route('**/api/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        const path = url.pathname.startsWith(`${apiPrefix}/`)
            ? url.pathname.slice(apiPrefix.length)
            : url.pathname;

        if (method !== 'GET' && method !== 'HEAD') {
            const write: BlockOptionsRecordedWrite = {
                method,
                path,
                url: request.url(),
                body: parseRequestBody(request.postData()),
            };
            writes.push(write);
            const response = (await state.respondToWrite?.(write)) ?? {};
            if (response === 'abort') {
                await route.abort('failed');
                return;
            }
            await route.fulfill({
                status: response.status ?? 200,
                headers: response.headers,
                json: response.json ?? {},
            });
            return;
        }

        if (!url.pathname.startsWith(`${apiPrefix}/`)) {
            await route.fallback();
            return;
        }

        if (path === '/api/data/weather/now') {
            // Weather is optional; the game treats a failure as "no data".
            await route.fulfill({ status: 404, json: null });
            return;
        }

        const json = readGet(path);
        if (json === undefined) {
            unhandledGets.push(path);
            await route.fulfill({
                status: 404,
                json: { error: 'Not served by the block-options harness.' },
            });
            return;
        }
        await route.fulfill({ json });
    });

    return {
        /** Every non-GET request, in order. */
        writes,
        /** App API GET paths the harness did not serve (answered 404). */
        unhandledGets,
        /** Writes to paths that match `pattern` (and `method`, if given). */
        writesTo: (pattern: RegExp, method?: string) =>
            writes.filter(
                (write) =>
                    pattern.test(write.path) &&
                    (method === undefined || write.method === method),
            ),
        setGarden: (garden: CurrentGarden) => {
            state.garden = garden;
        },
        setSunflowers: (amount: number) => {
            state.sunflowers = amount;
        },
        setCartSunflowers: (amount: number) => {
            state.cartSunflowers = amount;
        },
        setWriteResponder: (responder: BlockOptionsWriteResponder) => {
            state.respondToWrite = responder;
        },
    };
}

/**
 * Saves a review capture of the page (a PNG in the test's output folder,
 * never compared). On the CI software renderer one capture of the 3D stage
 * costs several seconds, so captures are taken only when
 * `GREDICE_BLOCK_OPTIONS_CAPTURES=1` is set, e.g. for a visual review run.
 */
export async function captureBlockOptionsReview(
    page: Page,
    options: NonNullable<Parameters<Page['screenshot']>[0]>,
) {
    if (process.env.GREDICE_BLOCK_OPTIONS_CAPTURES !== '1') {
        return;
    }
    await page.screenshot(options);
}

/** Collects uncaught page errors; assert it stays empty. */
export function collectPageErrors(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
}

/** The probe's current snapshot (`window.__blockOptionsProbe.snapshot()`). */
export async function readBlockOptionsProbe(
    page: Page,
): Promise<BlockOptionsProbeSnapshot | null> {
    return page.evaluate(() => window.__blockOptionsProbe?.snapshot() ?? null);
}

/**
 * Waits until the probe is installed, the garden and block data are loaded
 * and the scene has drawn, then until the given block can be projected.
 */
export async function waitForBlockOptionsFixture(
    page: Page,
    { blockId, timeout = 45_000 }: { blockId?: string; timeout?: number } = {},
) {
    await expect
        .poll(
            () =>
                page.evaluate(() => window.__blockOptionsProbe?.ready ?? false),
            { timeout },
        )
        .toBe(true);
    if (blockId) {
        await expect
            .poll(
                () =>
                    page.evaluate(
                        (id) =>
                            window.__blockOptionsProbe?.blockScreenPosition(
                                id,
                            ) ?? null,
                        blockId,
                    ),
                { timeout },
            )
            .not.toBeNull();
    }
}

/** Client position on a placed block (see `blockScreenPosition`). */
export async function getBlockScreenPosition(
    page: Page,
    blockId: string,
    part: 'anchor' | 'center' | 'top' = 'center',
) {
    const point = await page.evaluate(
        ([id, which]) =>
            window.__blockOptionsProbe?.blockScreenPosition(id, which) ?? null,
        [blockId, part] as const,
    );
    if (!point) {
        throw new Error(`Block ${blockId} is not in the fixture garden.`);
    }
    return point;
}

/**
 * A mouse double-click through CDP whose four events are stamped `gapMs`
 * apart, the way a real mouse stamps them. `page.mouse.dblclick` stamps each
 * event when it is sent, after the renderer acknowledged the previous one,
 * so under load its presses can land further apart than the double-click
 * window the game checks against `event.timeStamp`.
 */
export async function doubleClickWithMouse(
    page: Page,
    point: { x: number; y: number },
    gapMs = 40,
) {
    const cdp = await page.context().newCDPSession(page);
    const startedAt = Date.now();
    const events = [
        { type: 'mousePressed', buttons: 1, clickCount: 1 },
        { type: 'mouseReleased', buttons: 0, clickCount: 1 },
        { type: 'mousePressed', buttons: 1, clickCount: 2 },
        { type: 'mouseReleased', buttons: 0, clickCount: 2 },
    ] as const;
    try {
        for (const [index, event] of events.entries()) {
            const at = startedAt + index * gapMs;
            // Never stamp an event later than it is sent.
            const wait = at - Date.now();
            if (wait > 0) await page.waitForTimeout(wait);
            await cdp.send('Input.dispatchMouseEvent', {
                ...event,
                x: point.x,
                y: point.y,
                button: 'left',
                pointerType: 'mouse',
                timestamp: at / 1000,
            });
        }
    } finally {
        await cdp.detach();
    }
}

/**
 * Real touch input through CDP (`Input.dispatchTouchEvent`), because
 * `page.touchscreen.tap` cannot hold or drag. Detach when done.
 */
export async function createBlockOptionsTouch(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    let last = { x: 0, y: 0 };
    const send = (
        type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
        point: { x: number; y: number } | null,
    ) =>
        cdp.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: point ? [{ x: point.x, y: point.y, id: 1 }] : [],
        });

    return {
        start: async (point: { x: number; y: number }) => {
            last = point;
            await send('touchStart', point);
        },
        move: async (point: { x: number; y: number }) => {
            last = point;
            await send('touchMove', point);
        },
        end: () => send('touchEnd', null),
        /** Presses at `point`, holds for `ms` and lifts the finger there. */
        hold: async (point: { x: number; y: number }, ms: number) => {
            last = point;
            await send('touchStart', point);
            await page.waitForTimeout(ms);
            await send('touchEnd', null);
        },
        /** Moves the pressed finger to `point` in `steps` touchMove events. */
        dragTo: async (point: { x: number; y: number }, steps = 10) => {
            const from = last;
            for (let step = 1; step <= steps; step++) {
                last = {
                    x: from.x + ((point.x - from.x) * step) / steps,
                    y: from.y + ((point.y - from.y) * step) / steps,
                };
                await send('touchMove', last);
            }
        },
        detach: () => cdp.detach(),
    };
}
