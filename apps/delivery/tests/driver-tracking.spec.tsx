import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { DriverTrackingStatusStory } from './DriverTrackingStatusStory';
import { DriverTrackingStory } from './DriverTrackingStory';

const clockStart = new Date('2026-07-15T12:00:00.000Z');

type MockResponse = {
    status: number;
    body: object | null;
    deferred?: boolean;
};

async function installTrackingBrowser(
    page: Page,
    options: {
        permission?: PermissionState;
        online?: boolean;
        supported?: boolean;
    } = {},
) {
    await page.evaluate(
        ({ initialPermission, initialOnline, initialSupported }) => {
            let permission = initialPermission;
            let online = initialOnline;
            let visibility: DocumentVisibilityState = 'visible';
            let nextWatchId = 1;
            let clearCount = 0;
            let abortCount = 0;
            let refreshCount = 0;
            type Watcher = {
                success: PositionCallback;
                error: PositionErrorCallback | null;
            };
            const watchers = new Map<number, Watcher>();
            const stoppedWatchers = new Set<Watcher>();
            const oneShot = new Set<{
                success: PositionCallback;
                error: PositionErrorCallback | null;
            }>();
            const permissionListeners =
                new Set<EventListenerOrEventListenerObject>();
            const responses: Array<{
                status: number;
                body: object | null;
                deferred: boolean;
            }> = [];
            const deferredResponses: Array<() => void> = [];
            const requestBodies: unknown[] = [];
            const root = document.documentElement;

            const syncMetrics = () => {
                root.dataset.trackingWatchCount = String(watchers.size);
                root.dataset.trackingClearCount = String(clearCount);
                root.dataset.trackingAbortCount = String(abortCount);
                root.dataset.trackingRefreshCount = String(refreshCount);
                root.dataset.trackingOneShotCount = String(oneShot.size);
                root.dataset.trackingRequestCount = String(
                    requestBodies.length,
                );
                root.dataset.trackingRequestBodies =
                    JSON.stringify(requestBodies);
            };

            const permissionStatus = {
                get state() {
                    return permission;
                },
                onchange: null,
                addEventListener(
                    type: string,
                    listener: EventListenerOrEventListenerObject,
                ) {
                    if (type === 'change') permissionListeners.add(listener);
                },
                removeEventListener(
                    type: string,
                    listener: EventListenerOrEventListenerObject,
                ) {
                    if (type === 'change') permissionListeners.delete(listener);
                },
                dispatchEvent() {
                    return true;
                },
            };

            Object.defineProperty(navigator, 'onLine', {
                configurable: true,
                get: () => online,
            });
            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                get: () => visibility,
            });
            Object.defineProperty(navigator, 'permissions', {
                configurable: true,
                value: {
                    query: async () => permissionStatus,
                },
            });
            if (initialSupported) {
                Object.defineProperty(navigator, 'geolocation', {
                    configurable: true,
                    value: {
                        watchPosition(
                            success: PositionCallback,
                            error: PositionErrorCallback | null,
                        ) {
                            const id = nextWatchId++;
                            watchers.set(id, { success, error });
                            syncMetrics();
                            return id;
                        },
                        clearWatch(id: number) {
                            const watcher = watchers.get(id);
                            if (watcher) {
                                stoppedWatchers.add(watcher);
                                watchers.delete(id);
                                clearCount += 1;
                            }
                            syncMetrics();
                        },
                        getCurrentPosition(
                            success: PositionCallback,
                            error: PositionErrorCallback | null,
                        ) {
                            oneShot.add({ success, error });
                            syncMetrics();
                        },
                    },
                });
            } else {
                Reflect.deleteProperty(navigator, 'geolocation');
                const navigatorPrototype: object | null =
                    Object.getPrototypeOf(navigator);
                if (navigatorPrototype) {
                    Reflect.deleteProperty(navigatorPrototype, 'geolocation');
                }
            }

            window.addEventListener('tracking-test-position', (event) => {
                if (!(event instanceof CustomEvent)) return;
                const detail = event.detail;
                if (typeof detail !== 'object' || detail === null) return;
                const latitude = Reflect.get(detail, 'latitude');
                const timestamp = Reflect.get(detail, 'timestamp');
                const target = Reflect.get(detail, 'target');
                if (
                    typeof latitude !== 'number' ||
                    typeof timestamp !== 'number'
                ) {
                    return;
                }
                const position = {
                    coords: {
                        latitude,
                        longitude: 15.98,
                        accuracy: 7,
                        altitude: null,
                        altitudeAccuracy: null,
                        heading: 90,
                        speed: 5,
                        toJSON: () => ({}),
                    },
                    timestamp,
                    toJSON: () => ({}),
                };
                if (target === 'stale-watch') {
                    for (const watcher of stoppedWatchers) {
                        watcher.success(position);
                    }
                } else if (target !== 'one-shot') {
                    for (const watcher of watchers.values()) {
                        watcher.success(position);
                    }
                }
                if (target !== 'watch' && target !== 'stale-watch') {
                    for (const request of oneShot) request.success(position);
                    oneShot.clear();
                    syncMetrics();
                }
            });
            window.addEventListener('tracking-test-position-error', (event) => {
                if (!(event instanceof CustomEvent)) return;
                if (typeof event.detail !== 'number') return;
                const error: GeolocationPositionError = {
                    code: event.detail,
                    message: 'Location unavailable',
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3,
                };
                for (const watcher of watchers.values()) {
                    watcher.error?.(error);
                }
                for (const request of oneShot) request.error?.(error);
                oneShot.clear();
                syncMetrics();
            });
            window.addEventListener(
                'tracking-test-stale-position-error',
                () => {
                    const error: GeolocationPositionError = {
                        code: 3,
                        message: 'Location unavailable',
                        PERMISSION_DENIED: 1,
                        POSITION_UNAVAILABLE: 2,
                        TIMEOUT: 3,
                    };
                    for (const watcher of stoppedWatchers) {
                        watcher.error?.(error);
                    }
                },
            );
            window.addEventListener('tracking-test-permission', (event) => {
                if (!(event instanceof CustomEvent)) return;
                if (
                    event.detail !== 'granted' &&
                    event.detail !== 'prompt' &&
                    event.detail !== 'denied'
                ) {
                    return;
                }
                permission = event.detail;
                const change = new Event('change');
                for (const listener of permissionListeners) {
                    if (typeof listener === 'function') listener(change);
                    else listener.handleEvent(change);
                }
            });
            window.addEventListener('tracking-test-network', (event) => {
                if (!(event instanceof CustomEvent)) return;
                online = event.detail === 'online';
                window.dispatchEvent(new Event(online ? 'online' : 'offline'));
            });
            window.addEventListener('tracking-test-visibility', (event) => {
                if (!(event instanceof CustomEvent)) return;
                visibility = event.detail === 'hidden' ? 'hidden' : 'visible';
                document.dispatchEvent(new Event('visibilitychange'));
            });
            window.addEventListener('tracking-test-response', (event) => {
                if (!(event instanceof CustomEvent)) return;
                const detail = event.detail;
                if (typeof detail !== 'object' || detail === null) return;
                const status = Reflect.get(detail, 'status');
                const body = Reflect.get(detail, 'body');
                const deferred = Reflect.get(detail, 'deferred');
                if (typeof status !== 'number') return;
                responses.push({
                    status,
                    body:
                        typeof body === 'object' && body !== undefined
                            ? body
                            : null,
                    deferred: deferred === true,
                });
            });
            window.addEventListener('tracking-test-resolve', () => {
                deferredResponses.shift()?.();
            });
            window.addEventListener('driver-dashboard-refresh', () => {
                refreshCount += 1;
                syncMetrics();
            });

            window.fetch = async (_input, init) => {
                requestBodies.push(
                    typeof init?.body === 'string'
                        ? JSON.parse(init.body)
                        : null,
                );
                syncMetrics();
                const configured = responses.shift() ?? {
                    status: 200,
                    body: {
                        status: 'live',
                        acceptedAt: new Date().toISOString(),
                        refreshedAt: new Date().toISOString(),
                        replayed: false,
                    },
                    deferred: false,
                };
                const createResponse = () =>
                    new Response(JSON.stringify(configured.body), {
                        status: configured.status,
                        headers: { 'Content-Type': 'application/json' },
                    });
                if (!configured.deferred) return createResponse();
                return await new Promise<Response>((resolve, reject) => {
                    let settled = false;
                    const finish = () => {
                        if (settled) return;
                        settled = true;
                        resolve(createResponse());
                    };
                    deferredResponses.push(finish);
                    init?.signal?.addEventListener(
                        'abort',
                        () => {
                            if (settled) return;
                            settled = true;
                            abortCount += 1;
                            syncMetrics();
                            reject(new DOMException('Aborted', 'AbortError'));
                        },
                        { once: true },
                    );
                });
            };
            syncMetrics();
        },
        {
            initialPermission: options.permission ?? 'granted',
            initialOnline: options.online ?? true,
            initialSupported: options.supported ?? true,
        },
    );
}

async function queueResponse(page: Page, response: MockResponse) {
    await page.evaluate((detail) => {
        window.dispatchEvent(
            new CustomEvent('tracking-test-response', { detail }),
        );
    }, response);
}

async function emitPosition(
    page: Page,
    latitude: number,
    timestamp: number,
    target?: 'watch' | 'one-shot' | 'stale-watch',
) {
    await page.evaluate(
        (detail) => {
            window.dispatchEvent(
                new CustomEvent('tracking-test-position', { detail }),
            );
        },
        { latitude, timestamp, target },
    );
}

async function setPermission(page: Page, permission: PermissionState) {
    await page.evaluate((detail) => {
        window.dispatchEvent(
            new CustomEvent('tracking-test-permission', { detail }),
        );
    }, permission);
}

async function emitPositionError(page: Page, code: 1 | 2 | 3) {
    await page.evaluate((detail) => {
        window.dispatchEvent(
            new CustomEvent('tracking-test-position-error', { detail }),
        );
    }, code);
}

async function emitStalePositionError(page: Page) {
    await page.evaluate(() => {
        window.dispatchEvent(new Event('tracking-test-stale-position-error'));
    });
}

test('claims active tracking only after a complete acknowledgement', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, {
        status: 200,
        deferred: true,
        body: {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:01.000Z',
            refreshedAt: '2026-07-15T12:00:01.000Z',
            replayed: false,
        },
    });
    const component = await mount(<DriverTrackingStory />);
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-watch-count',
        '1',
    );
    await emitPosition(page, 45.81, clockStart.getTime());
    await expect(component).toHaveAttribute('data-status', 'sending');
    await expect(component).not.toHaveAttribute('data-status', 'active');

    await page.evaluate(() => {
        window.dispatchEvent(new Event('tracking-test-resolve'));
    });
    await expect(component).toHaveAttribute('data-status', 'active');
    await expect(component).toHaveAttribute(
        'data-last-accepted-at',
        '2026-07-15T12:00:01.000Z',
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-refresh-count',
        '0',
    );
});

test('failure stays visible and retries only the newest coordinate after throttle', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, { status: 500, body: null });
    await queueResponse(page, {
        status: 200,
        body: {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:11.000Z',
            refreshedAt: '2026-07-15T12:00:11.000Z',
            replayed: false,
        },
    });
    const component = await mount(<DriverTrackingStory />);
    await emitPosition(page, 45.81, clockStart.getTime());
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await emitPosition(page, 45.82, clockStart.getTime() + 1_000);
    await emitPosition(page, 45.83, clockStart.getTime() + 2_000);
    await page.clock.fastForward(9_000);
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '1',
    );
    await page.clock.fastForward(1_000);
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '2',
    );
    await expect(component).toHaveAttribute('data-status', 'active');
    const bodies = await page
        .locator('html')
        .getAttribute('data-tracking-request-bodies');
    expect(bodies).not.toBeNull();
    expect(JSON.parse(bodies ?? '[]')).toMatchObject([
        { latitude: 45.81 },
        { latitude: 45.83 },
    ]);
});

test('slow successful response keeps its server and client transit age', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, {
        status: 200,
        deferred: true,
        body: {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:00.000Z',
            refreshedAt: '2026-07-15T12:00:00.000Z',
            replayed: false,
        },
    });
    const component = await mount(<DriverTrackingStory />);
    await emitPosition(page, 45.81, clockStart.getTime());
    await page.clock.fastForward(19_000);
    await page.evaluate(() => {
        window.dispatchEvent(new Event('tracking-test-resolve'));
    });
    await expect(component).toHaveAttribute('data-status', 'active');
    await page.clock.fastForward(11_001);
    await expect(component).toHaveAttribute('data-status', 'delayed');
});

test('permission changes restart accurately and revocation clears exact work', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page, { permission: 'denied' });
    const component = await mount(<DriverTrackingStory />);
    await expect(component).toHaveAttribute('data-status', 'denied');
    await setPermission(page, 'granted');
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-watch-count',
        '1',
    );
    await emitPosition(page, 45.81, clockStart.getTime());
    await expect(component).toHaveAttribute('data-status', 'active');
    await setPermission(page, 'denied');
    await expect(component).toHaveAttribute('data-status', 'denied');
    await expect(component).toHaveAttribute('data-retry-attempt', '0');
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-clear-count',
        '1',
    );
    await emitPosition(
        page,
        45.82,
        clockStart.getTime() + 1_000,
        'stale-watch',
    );
    await emitStalePositionError(page);
    await expect(component).toHaveAttribute('data-status', 'denied');
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '1',
    );
});

test('a server seed cannot start tracking on an unsupported browser', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page, { supported: false });
    const component = await mount(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:00.000Z"
            serverStatus="live"
        />,
    );
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await expect(component).toContainText(
        'Ovaj uređaj ili preglednik ne podržava GPS praćenje',
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-watch-count',
        '0',
    );
});

test('a newer server seed cannot bypass denied location permission', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page, { permission: 'denied' });
    const component = await mount(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:00.000Z"
            serverStatus="live"
        />,
    );
    await expect(component).toHaveAttribute('data-status', 'denied');
    await component.update(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:10.000Z"
            refreshedAt="2026-07-15T12:00:10.000Z"
            serverStatus="live"
        />,
    );
    await expect(component).toHaveAttribute('data-status', 'denied');
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-watch-count',
        '0',
    );
});

test('visibility recovery advances a retry but never bypasses minimum interval', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, { status: 503, body: null });
    await queueResponse(page, {
        status: 200,
        body: {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:10.000Z',
            refreshedAt: '2026-07-15T12:00:10.000Z',
            replayed: false,
        },
    });
    const component = await mount(<DriverTrackingStory />);
    await emitPosition(page, 45.81, clockStart.getTime());
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await page.clock.fastForward(9_000);
    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('tracking-test-visibility', {
                detail: 'hidden',
            }),
        );
        window.dispatchEvent(
            new CustomEvent('tracking-test-visibility', {
                detail: 'visible',
            }),
        );
    });
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '1',
    );
    await page.clock.fastForward(1_000);
    await expect(component).toHaveAttribute('data-status', 'active');
});

test('run switch aborts old work and unmount removes watchers and timers', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, {
        status: 200,
        body: {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:01.000Z',
            refreshedAt: '2026-07-15T12:00:01.000Z',
            replayed: false,
        },
        deferred: true,
    });
    const component = await mount(<DriverTrackingStory runId="run-one" />);
    await emitPosition(page, 45.81, clockStart.getTime());
    await expect(component).toHaveAttribute('data-status', 'sending');
    await component.update(<DriverTrackingStory runId="run-two" />);
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-abort-count',
        '1',
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-clear-count',
        '1',
    );
    await emitPosition(page, 45.82, clockStart.getTime() + 1_000);
    await expect(component).toHaveAttribute('data-status', 'active');
    await component.unmount();
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-clear-count',
        '2',
    );
    await emitPosition(page, 45.83, clockStart.getTime() + 2_000);
    await page.clock.fastForward(30_000);
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '2',
    );
});

test('server seed crosses the live threshold and wall resume cannot keep it falsely active', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    const component = await mount(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:00.000Z"
            serverStatus="live"
        />,
    );
    await expect(component).toHaveAttribute('data-status', 'active');
    await page.clock.fastForward(30_001);
    await expect(component).toHaveAttribute('data-status', 'delayed');
});

test('equal server freshness ages an acknowledgement without hiding a failed upload', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, { status: 500, body: null });
    const component = await mount(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:00.000Z"
            serverStatus="live"
        />,
    );
    await emitPosition(page, 45.81, clockStart.getTime() + 1_000);
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await component.update(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:31.000Z"
            serverStatus="delayed"
        />,
    );
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await expect(component).toHaveAttribute('data-retry-attempt', '1');
});

test('permanent run rejection refreshes dashboard state and does not blame GPS settings', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, { status: 403, body: null });
    const component = await mount(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:00.000Z"
            serverStatus="live"
        />,
    );
    await emitPosition(page, 45.81, clockStart.getTime() + 1_000);
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await expect(component).toContainText('ruta ili prijava');
    await expect(
        component.getByRole('button', { name: 'Osvježi dostave' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-refresh-count',
        '1',
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-watch-count',
        '0',
    );
    await component.update(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:31.000Z"
            serverStatus="delayed"
        />,
    );
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await component.update(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:40.000Z"
            refreshedAt="2026-07-15T12:00:41.000Z"
            serverStatus="live"
        />,
    );
    await expect(component).toHaveAttribute('data-status', 'active');
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-watch-count',
        '1',
    );
});

test('permanent rejection ignores a late concurrent one-shot GPS callback', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, { status: 403, body: null });
    const component = await mount(<DriverTrackingStory />);
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pageshow'));
    });
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-one-shot-count',
        '1',
    );
    await emitPosition(page, 45.81, clockStart.getTime(), 'watch');
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await expect(component).toContainText('ruta ili prijava');
    await emitPositionError(page, 3);
    await emitPosition(
        page,
        45.82,
        clockStart.getTime() + 1_000,
        'stale-watch',
    );
    await emitStalePositionError(page);
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await expect(component).toContainText('ruta ili prijava');
    await expect(
        component.getByRole('button', { name: 'Osvježi dostave' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '1',
    );
});

test('offline exact telemetry expires in memory before a later reconnect', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page, { online: false });
    const component = await mount(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:00.000Z"
            serverStatus="live"
        />,
    );
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await expect(component).toHaveAttribute('data-sample-queued', 'false');
    await expect(component).toContainText('Nema internetske veze');
    await emitPosition(page, 45.81, clockStart.getTime());
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await expect(component).toHaveAttribute('data-sample-queued', 'true');
    await page.clock.fastForward(120_001);
    await expect(component).toHaveAttribute('data-sample-queued', 'false');
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '0',
    );
    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('tracking-test-network', { detail: 'online' }),
        );
    });
    await page.clock.fastForward(10_000);
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '0',
    );
});

test('reconnecting without a queued sample replaces stale offline copy with a GPS timeout', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    const component = await mount(<DriverTrackingStory />);
    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('tracking-test-network', { detail: 'offline' }),
        );
    });
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await expect(component).toContainText('Nema internetske veze');
    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent('tracking-test-network', { detail: 'online' }),
        );
    });
    await expect(component).toHaveAttribute('data-status', 'requesting');
    await emitPositionError(page, 3);
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await expect(component).toContainText(
        'GPS lokacija trenutačno nije dostupna',
    );
    await expect(component).not.toContainText('Nema internetske veze');
});

test('online backoff wakes at sample expiry and discards exact telemetry first', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await queueResponse(page, { status: 500, body: null });
    const component = await mount(<DriverTrackingStory />);
    await emitPosition(page, 45.81, clockStart.getTime() - 119_000);
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await expect(component).toHaveAttribute('data-sample-queued', 'true');
    await page.clock.fastForward(1_001);
    await expect(component).toHaveAttribute('data-sample-queued', 'false');
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-request-count',
        '1',
    );
});

test('fresh acknowledgement survives a GPS timeout, then surfaces it when delayed', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    const component = await mount(
        <DriverTrackingStory
            lastAcceptedAt="2026-07-15T12:00:00.000Z"
            refreshedAt="2026-07-15T12:00:00.000Z"
            serverStatus="live"
        />,
    );
    await emitPositionError(page, 3);
    await expect(component).toHaveAttribute('data-status', 'active');
    await page.clock.fastForward(30_001);
    await expect(component).toHaveAttribute('data-status', 'unavailable');
    await expect(component).toContainText(
        'GPS lokacija trenutačno nije dostupna',
    );
    await emitPosition(page, 45.81, clockStart.getTime() + 31_000);
    await expect(component).toHaveAttribute('data-status', 'active');
});

test('compatibility timeout aborts a hung upload and preserves retry state', async ({
    mount,
    page,
}) => {
    await page.clock.install({ time: clockStart });
    await installTrackingBrowser(page);
    await page.evaluate(() => {
        Object.defineProperty(AbortSignal, 'any', {
            configurable: true,
            value: undefined,
        });
        Object.defineProperty(AbortSignal, 'timeout', {
            configurable: true,
            value: undefined,
        });
    });
    await queueResponse(page, {
        status: 200,
        body: {
            status: 'live',
            acceptedAt: '2026-07-15T12:00:01.000Z',
            refreshedAt: '2026-07-15T12:00:01.000Z',
            replayed: false,
        },
        deferred: true,
    });
    const component = await mount(<DriverTrackingStory />);
    await emitPosition(page, 45.81, clockStart.getTime());
    await expect(component).toHaveAttribute('data-status', 'sending');
    await page.clock.fastForward(20_000);
    await expect(component).toHaveAttribute('data-status', 'retrying');
    await expect(component).toHaveAttribute('data-sample-queued', 'true');
    await expect(page.locator('html')).toHaveAttribute(
        'data-tracking-abort-count',
        '1',
    );
});

test('Croatian states expose accessible recovery guidance without assertive churn', async ({
    mount,
}) => {
    const component = await mount(
        <DriverTrackingStatusStory status="sending" />,
    );
    await expect(component.getByRole('status')).toContainText(
        'GPS lokacija se šalje',
    );
    await component.update(<DriverTrackingStatusStory status="delayed" />);
    await expect(
        component.getByRole('button', { name: 'Pokušaj sada' }),
    ).toBeVisible();
    await expect(component).toContainText('stranica vidljiva i aktivna');
    await component.update(
        <DriverTrackingStatusStory
            reason="offline"
            sampleQueued
            status="retrying"
        />,
    );
    await expect(component).toContainText('čeka slanje');
    await expect(
        component.getByRole('button', { name: 'Pokušaj sada' }),
    ).toHaveCount(0);
    await component.update(
        <DriverTrackingStatusStory
            reason="permission-denied"
            status="denied"
        />,
    );
    await expect(
        component.getByRole('button', {
            name: 'Ponovno provjeri dopuštenje',
        }),
    ).toBeVisible();
    await component.update(
        <DriverTrackingStatusStory
            reason="server-rejected"
            status="unavailable"
        />,
    );
    await expect(
        component.getByRole('button', { name: 'Osvježi dostave' }),
    ).toBeVisible();
    await expect(component.getByRole('group')).toHaveAttribute(
        'aria-label',
        'Status GPS praćenja',
    );
    await expect(component.getByRole('alert')).toHaveCount(0);
});
